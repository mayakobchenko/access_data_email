import dotenv from 'dotenv';
import {emailHtmlText} from './htmlEmail.js';
import logger from './logger.js';
import fetch from 'node-fetch';
dotenv.config();

const maya_token = process.env.MAYA_ZAMMAD_TOKEN;
const token_maya = "Bearer " + maya_token;
const zammadBaseUrl = 'https://support.humanbrainproject.eu/';
const urlSendEmail = `${zammadBaseUrl}/api/v1/ticket_articles`;

export async function sendEmailOnWebhookZammad(contactPersonName, recipientEmail, positionContact, institution, departm, purposeAccess, dataTitle, dataset_uuid, ticketId, nameCustodian, surnameCustodian, emailCustodian) { 
    //text of the email to the data custodian
    const emailHtml = emailHtmlText(contactPersonName, recipientEmail, positionContact, institution, departm, purposeAccess, dataTitle, dataset_uuid, nameCustodian, surnameCustodian);
    const content = {
        "ticket_id": ticketId,  
        "subject": "Data access request",
        "body": emailHtml,
        "content_type": "text/html",
        "type": "email",
        "internal": "false",
        "sender": "Agent",
        "time_unit": "0",
        //"internal": true,  //set true if wnat to be hidden from external user
        // "from":"curation-support@ebrains.eu", -- fails at SMTP
        "origin_by_id": "1292",
        "to": emailCustodian  //data custodian email
    };
    try {
        const response = await fetch(urlSendEmail, {
            method: 'post',
            body: JSON.stringify(content),
            headers: {'Content-Type': 'application/json', 'Authorization': token_maya}
        });
        const data = await response.json();
        if (response.ok) {
            logger.info(`Email is sent to the data custodian, message id: ${data.message_id}`);
        }
        else {
            throw new Error('Error sending email to the data custodian: ' + response.status);
        }
    } catch (error) {
        throw new Error(`Error sending email: ${error.message}`);
    }
};