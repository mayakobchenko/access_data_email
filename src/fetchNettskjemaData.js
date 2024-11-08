//put here nettskjema api endpoints to fetch data

import fetch from 'node-fetch';
import {NETTSKJEMA_QUESTIONS_ID} from './constants.js';

export async function fetchSubmission(submissionId, tokenNettskjema) {
    const response = await fetch(`https://api.nettskjema.no/v3/form/submission/${submissionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${tokenNettskjema}`,
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch submission data`);
    }
    const submissionData = await response.json();
    return submissionData;
}

export async function fetchAnswers(submissionData) {
    const datasetElementId = NETTSKJEMA_QUESTIONS_ID['DatasetID'];
    let result;
    try{
        if (!submissionData || !Array.isArray(submissionData['answers'])) {
            throw new Error("Invalid submission data or missing answers");
        }
        result = submissionData['answers'].find(item => item.elementId === datasetElementId);
        if (!result) {
            throw new Error("DatasetID not found in nettskjema");
        }
    }catch (error) {
        console.error('Could not find dataset version id in the nettskjema:', error);
        throw(error);
    };    
    const datasetID = result['textAnswer'];

    return datasetID;
}