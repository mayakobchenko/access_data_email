//https://nettskjema.no/user/form/127835/view
//nettskjema for requests to access externally hosted datasets

// the nettskjema endpoint https://api.nettskjema.no/v3/form/127835/definition
//has elementId and externalElementId which is text - i save this in the constant file

//in case of new version of nettskjema, elementId (or questionId) can be found by externalElementId
const DRF_ID = 127835;

export const NETTSKJEMA_QUESTIONS_ID = {
    "DatasetTitle": 3748463,
    "DatasetID" : 4694463,
    "FullName" : 1716143,
    "Email" : 1716144,
    "Institution" : 1716160,
    "Department" : 	1716161,
    "Position" : 	1716162,  //"CHECKBOX" with answer options
    "PositionOther" : 1716169,  //if the position has answer "other"
    "Orcid" : 1716170,
    "Purpose" : 1716171
};