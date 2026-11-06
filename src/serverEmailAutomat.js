import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {fetchToken} from './tokenFetcher.js';
import {sendEmailOnWebhookZammad} from './sendEmailOnWebhookZammad.js';
import {htmlPageContent} from './mainPageContent.js';
import {fetchSubmission, fetchAnswers, fetchPosition} from './fetchNettskjemaData.js';
import {getRequestOptions} from './kgAuthentication.js';
import {contactInfoKG} from './contactDataKG.js'; 
import logger from './logger.js';
import {errorNotificationZammad} from './sendErrorEmailZammad.js'; 
import {zammadTicket} from './getZammadTicketInfo.js';
import { sendReply } from './sendReplyRequester.js';
import { webhookAllowed, authConfigured } from './webhookAuth.js';
import { createHandledTickets } from './handledTickets.js';

//intended to send the data link to the data custodian, but emails get spam filtered
//changed the webhook playload, no need for extractSubmissionId
//import {modifyUrlPath, extractSubmissionId} from './changeUrl.js'; 

dotenv.config(); 

//work around for ECMAScript modules (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
const port = process.env.PORT || 4000;

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

//a simple frontend page just for showing something
app.use('/public', express.static(path.join(__dirname, 'public')));
async function mainAppPage() {
    return htmlPageContent;
}

app.get('/', async (req, res, next) => {
    try {
        const data = await mainAppPage();
        res.send(data);
    } catch (error) {
        logger.error(`Internal Server Error: ${error.message}`, error);
        next(error);
    }
});

//to test if app is working - get requests
app.get('/health', async (req, res) => {
    res.status(200).json({ status: 'UP' });
});

// to test post requests
//change it back to test, and place webhook back
app.post('/test', async (req, res) => {
    //const event = req.body.event;  
    const testData = req.body;
    logger.info('Incoming post request from the test endpoint');
    const testString = JSON.stringify(testData, null, 2);
    logger.info(`Received test JSON: ${testString}`);
    res.status(200).json({ status: 'success test', received: testData });
    console.log(testData.ticket_id);
});

//use my ebrain token for testing 
//const maya_token = process.env.MAYA_EBRAIN_TOKEN;
//const token_maya = "Bearer " + maya_token;
//const myHeaders = new Headers();
//myHeaders.append("Content-Type", "application/json");
//myHeaders.append("Authorization", token_maya);    
//myHeaders.append("Accept", '*/*');
//const mayaHeaders = {headers: myHeaders};

// Who is allowed to call the webhook: see webhookAuth.js (WEBHOOK_SECRET and/or WEBHOOK_BEARER_TOKEN)
const webhookAuth = { secret: process.env.WEBHOOK_SECRET, bearer: process.env.WEBHOOK_BEARER_TOKEN };
const handledTickets = createHandledTickets();

// address and ticket for the error reports (the log file is sent there when something fails)
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'maya.kobchenko@medisin.uio.no';
const SUPPORT_TICKET_ID = parseInt(process.env.SUPPORT_TICKET_ID || '24211', 10); //test_mayas_app [Ticket#4824171]

//the main endpoint that will receive webhook
app.post('/webhook', async (req, res) => {
    if (!webhookAllowed(req, webhookAuth)) {
        logger.warn('Webhook call refused: missing or wrong signature/token');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const jsonData = req.body || {};
    logger.info('New zammad webhook post request');
    //zammad webhook sends 5 post requests, need to send response to stop posting
    res.status(200).json({ status: 'success' });
    const ticketId = jsonData.ticket_id;
    logger.info(`Incoming post request, zammad ticket id: ${ticketId}`);
    if (!Number.isInteger(ticketId) && !/^\d+$/.test(String(ticketId ?? ''))) {
        logger.warn('Webhook without a ticket id, ignored');
        return;
    }
    //the same ticket is handled only once (repeated webhook calls, and our own emails that add articles to the ticket)
    if (!handledTickets.claim(ticketId)) {
        logger.info(`Ticket ${ticketId} was already handled, ignored`);
        return;
    }
    let submissionId;
    try {
        const ticket = await zammadTicket(ticketId);
        const { isTicket, ticketNumber } = ticket;
        submissionId = ticket.submissionId;
        logger.info(`Zammad ticket number: ${ticketNumber}, is it data access request: ${isTicket}`);
        if (!isTicket) {
            logger.info('incoming ticket is not related to data request');
            return;
        }
        //we created a query manually in KG editor named = fetch_data_custodian_info
        const queryID = 'de7e79ae-5b67-47bf-b8b0-8c4fa830348e';
        const tokenNettskjema = await fetchToken();
        logger.info("token for nettskjema is fetched successfully");
        const submissionData = await fetchSubmission(submissionId, tokenNettskjema);
        logger.info("successfully fetched submission data from the nettskjema api");
        const datasetID = await fetchAnswers(submissionData);
        logger.info(`requested dataset id: ${datasetID}`);
        //requestOptions: dedicated service account of the KG
        const requestOptions = await getRequestOptions();
        const {nameCustodian, surnameCustodian, emailCustodian} = await contactInfoKG(queryID, datasetID, requestOptions);
        logger.info("successfully fetched data custodian contact info from KG");

        //from submitted nettskjema
        const answer = (id) => {
            const a = submissionData['answers'].find(d => d['externalElementId'] === id);
            if (!a) throw new Error(`The answer "${id}" is missing in the nettskjema submission ${submissionId}`);
            return a;
        };
        const respondentName = submissionData['submissionMetadata']['person']['name'];
        const respondentEmail = submissionData['submissionMetadata']['person']['email'];
        const dataTitle = answer('DatasetTitle')['textAnswer'];
        const instituionCorrespondent = answer('Institution')['textAnswer'];
        const departm = answer('Department')['textAnswer'];
        const positionCode = answer('Position')['answerOptionIds'];//people write several positions
        const posContact = [];
        for (const code of positionCode) {
            posContact.push(await fetchPosition(submissionId, tokenNettskjema, code));
        }
        const positionContact = posContact.join(', ');
        const purposeAccess = answer('Purpose')['textAnswer'];

        if (!emailCustodian || !emailCustodian['email'] || emailCustodian['email'].length === 0) {
            throw new Error('Custodian of the dataset did not provide contact information.');
        }
        //both emails are awaited: a failure is reported to support instead of ending the process
        await sendEmailOnWebhookZammad(respondentName, respondentEmail, positionContact, instituionCorrespondent, departm, purposeAccess, dataTitle, datasetID, ticketId, nameCustodian, surnameCustodian, emailCustodian['email']);
        //reply to the person that requested data
        await sendReply(respondentName, respondentEmail, dataTitle, datasetID, ticketId);
    } catch (error) {
        handledTickets.release(ticketId);   // a later webhook call may try again
        logger.error(`Something is not working: ${error.message}`, error);
        try {
            const logFilePath = path.resolve(__dirname, '../restrictedaccess.log');
            const base64Data = Buffer.from(fs.readFileSync(logFilePath, { encoding: 'utf8' })).toString('base64');
            await errorNotificationZammad(ticketId, SUPPORT_TICKET_ID, submissionId, base64Data, SUPPORT_EMAIL);
        } catch (notifyError) {
            logger.error(`The error report to support could not be sent: ${notifyError.message}`);
        }
    }
});

//must come after the routes
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`);
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? 'Bad Request' : 'Internal Server Error' });
});

//a forgotten error in some step must never end the process
process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.message : reason}`);
});

app.listen(port, async () => {
    logger.info(`Server is running on port ${port}`);
    if (!authConfigured(webhookAuth)) logger.warn('WEBHOOK_SECRET / WEBHOOK_BEARER_TOKEN are not set: the webhook endpoint accepts calls from anyone');
});