import {getRequestOptions} from './kgAuthentication.js'
import {fetchToken} from './tokenFetcher.js';

try {
    const requestOptions = await getRequestOptions();
    //const {nameCustodian, surnameCustodian, emailCustodian} = await contactInfoKG(queryID, datasetID, mayaHeaders);
    //const {nameCustodian, surnameCustodian, emailCustodian} = await contactInfoKG(queryID, datasetID, requestOptions);
    console.log("successfully fetched data custodian contact info from KG");
   // console.log(requestOptions)
    const tokenNettskjema = await fetchToken()
    console.log(tokenNettskjema)
} catch (error) {
    console.log(`Error running fetchCore...bla bla`, error);
}