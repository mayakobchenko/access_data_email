import dotenv from 'dotenv';
import {fetchToken} from './tokenFetcher.js';
import {sendEmailOnWebhookZammad} from './sendEmailOnWebhookZammad.js';
import {fetchSubmission, fetchAnswers, fetchPosition} from './fetchNettskjemaData.js';
import {getRequestOptions} from './kgAuthentication.js';
import {contactInfoKG} from './contactDataKG.js'; 
import {zammadTicket} from './getZammadTicketInfo.js';
import { sendReply } from './sendReplyRequester.js';
 
dotenv.config(); 

const ticketId = 26384 //25125;
const {isTicket, ticketNumber, submissionId} = await zammadTicket(ticketId);
console.log('ticket number is:', ticketNumber);
const queryID = 'de7e79ae-5b67-47bf-b8b0-8c4fa830348e';
try {  
    if (isTicket) {
        const tokenNettskjema = await fetchToken();
        console.log("token for nettskjema is fetched successfully");
        const submissionData = await fetchSubmission(submissionId, tokenNettskjema);
        console.log("successfully fetched submission data from the nettskjema api");
        const datasetID = await fetchAnswers(submissionData);
        console.log(`requested dataset id: ${datasetID}`);
        const requestOptions = await getRequestOptions();
        const {nameCustodian, surnameCustodian, emailCustodian} = await contactInfoKG(queryID, datasetID, requestOptions);
        console.log("successfully fetched data custodian contact info from KG");

        const respondentName = submissionData['submissionMetadata']['person']['name'];
        const respondentEmail = submissionData['submissionMetadata']['person']['email'];
        const datasetTitle = submissionData['answers'].find(d => d['externalElementId']==='DatasetTitle');
        const dataTitle = datasetTitle['textAnswer'];
        const institution = submissionData['answers'].find(d => d['externalElementId']==='Institution');
        const instituionCorrespondent = institution['textAnswer'];
        const department = submissionData['answers'].find(d => d['externalElementId']==='Department');
        const departm = department['textAnswer'];
        const position = submissionData['answers'].find(d => d['externalElementId']==='Position');
        const positionCode = position['answerOptionIds'];//people write several positions
        const posContact = [];
        for (const code of positionCode) {
            const position = await fetchPosition(submissionId, tokenNettskjema, code);
            posContact.push(position);     
        }
        const positionContact = posContact.join(', ');
        const purpose = submissionData['answers'].find(d => d['externalElementId']==='Purpose');
        const purposeAccess = purpose['textAnswer'];
    
        if (emailCustodian['email'].length>0){
            //const testTicketId = 24211; //my test ticket in zammad
            //sendEmailOnWebhookZammad(respondentName, respondentEmail, positionContact, instituionCorrespondent, departm, purposeAccess, dataTitle, datasetID, testTicketId, nameCustodian, surnameCustodian, 'maya.kobchenko@medisin.uio.no');
            sendEmailOnWebhookZammad(respondentName, respondentEmail, positionContact, instituionCorrespondent, departm, purposeAccess, dataTitle, datasetID, ticketId, nameCustodian, surnameCustodian, emailCustodian['email']);
            //in prod: replace my uio email by the email of the custodian: emailCustodian['email']; replace my test ticket by actuall ticketId of the request
            //reply to the person that requested data
            //set to internal true (locked) if you want to hide the thread
            //sendReply(respondentName, 'maya.kobchenko@medisin.uio.no', dataTitle, datasetID, testTicketId);//for testing
            sendReply(respondentName, respondentEmail, dataTitle, datasetID, ticketId); //in prod
        } else {
            throw new Error('Custodian of the dataset did not provide contact information.');
        }
    } else {
        console.log('incoming ticket is not related to data request');
    }
} catch (error) {
    //const logFilePath = path.resolve(__dirname, '../restrictedaccess.log');
    //const fileContent = fs.readFileSync(logFilePath, { encoding: 'utf8' });
    //const base64Data = Buffer.from(fileContent).toString('base64');
    //const emailSupport = 'maya.kobchenko@medisin.uio.no'; 
    //const supportTicketId = 24211; //test_mayas_app [Ticket#4824171]
    //await errorNotificationZammad(ticketId, supportTicketId, submissionId, base64Data, emailSupport);
    console.log(error); 
}; 
