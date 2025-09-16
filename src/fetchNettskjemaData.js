import fetch from 'node-fetch';
import {NETTSKJEMA_QUESTIONS_ID, DRF_ID} from './constants.js';

export async function fetchSubmission(submissionId, tokenNettskjema) {
    try {
        const response = await fetch(`https://nettskjema.no/api/v3/form/submission/${submissionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenNettskjema}`,
                'Accept': 'application/json'
            }
        });
        const submissionData = await response.json();
        const keys = Object.keys(submissionData);
        if (keys.length < 2) {
            console.log(`wrong submission id: ${submissionData.message}`);
            throw new Error(`wrong submission id: ${submissionData.message}`);
          } 
        return submissionData;
    } catch (error) {
        throw new Error(`Failed to fetch submission data from nettskjema api: ${error.message}`);
    }
}

export async function fetchAnswers(submissionData) {
    const datasetElementId = NETTSKJEMA_QUESTIONS_ID['DatasetID'];
    let result;
    try{
        if (!submissionData || !Array.isArray(submissionData['answers'])) {
            throw new Error("Invalid submission data or missing answers field");
        }
        result = submissionData['answers'].find(item => item.elementId === datasetElementId);
        if (!result) {
            throw new Error("DatasetID not found in nettskjema");
        }
        const datasetID = result['textAnswer'];
        return datasetID;
    }catch (error) {
        throw new Error(`Problem fetching dataset version id from the nettskjema:: ${error.message}`);
    };    
}

export async function fetchPosition(extractedSubmissionId, tokenNettskjema, positionAnswerCode) {
    const positionElementId = 1716162;
    try {
        const response = await fetch(`https://nettskjema.no/api/v3/form/${DRF_ID}/definition`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenNettskjema}`,
                'Accept': 'application/json'  
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to connect to nettskjema definition endpoint: ${response.status}`);
        }
        const submissionData = await response.json();
        const positionIds = submissionData["elements"].find(d => d["elementId"]===positionElementId);
        const positionAnswerId = positionIds['answerOptions'].find(d => d["answerOptionId"]===positionAnswerCode);
        
        let positionAnswer;   
        if (positionAnswerId["text"]==="Other"){
            const submissionData = await fetchSubmission(extractedSubmissionId, tokenNettskjema);
            const positionOtherId = submissionData['answers'].find(d => d['externalElementId']==='PositionOther');
            positionAnswer = positionOtherId['textAnswer'];
        }else {    
            positionAnswer = positionAnswerId["text"];}
    
        return positionAnswer;
    }catch(error) {
        throw new Error(`Problem fetching from nettskjema definition endpoint: ${error.message}`);
    }
}