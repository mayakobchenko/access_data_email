import dotenv from 'dotenv';
import {notificationError} from './htmlNotificationError.js'; 
import logger from './logger.js';
import fetch from 'node-fetch';

dotenv.config();

const maya_token = process.env.MAYA_ZAMMAD_TOKEN;
const token_maya = "Bearer " + maya_token;
const zammadBaseUrl = 'https://support.humanbrainproject.eu/';
const urlSendEmail = `${zammadBaseUrl}/api/v1/ticket_articles`;

export async function errorNotificationZammad(ticketId, supportTicketId, submissionId, attachedFile, emailSupport) { 
    const emailHtml = notificationError(ticketId, submissionId);
    const content = {
        "ticket_id": supportTicketId,  
        "subject": "test_mayas_app [Ticket#4824171]",
        "body": emailHtml,
        "content_type": "text/html",
        "type": "email",
        "internal": "false",
        "sender": "Agent",
        "time_unit": "0",
        "to": emailSupport, 
        "origin_by_id": "1292",  //in zammad it looks like emails are from support
        "attachments": [
            {   filename: 'restrictedaccess.log',  // Use the appropriate filename
                data: attachedFile,
                "mime-type": 'text/plain' // Assuming it's a plain text log file
            }]
    };
    try {
        const response = await fetch(urlSendEmail, {
            method: 'post',
            body: JSON.stringify(content),
            headers: {'Content-Type': 'application/json', 'Authorization': token_maya}
        });
        const data = await response.json();
        if (response.ok) {
            logger.info(`Log file is sent to support, message id: ${data.message_id}`);
        }
        else {
            throw new Error('Error sending log file: ' + response.status);
        }
    } catch (error) {
        throw new Error(`Error sending email to support: ${error.message}`);
    }
};