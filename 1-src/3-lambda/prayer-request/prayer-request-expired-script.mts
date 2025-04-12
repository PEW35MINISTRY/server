import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { ExpiredPrayerRequest } from "../../1-api/5-prayer-request/prayer-request-types.mjs";
import { sendNotificationMessage, sendNotificationPairedMessage } from "../../1-api/8-notification/notification-utilities.mjs";
import { DB_SELECT_EXPIRED_PRAYER_REQUESTS_PAGINATED, DB_UPDATE_RESOLVE_PRAYER_REQUEST_BATCH } from "../../2-services/2-database/queries/prayer-request-queries.mjs";
import { initializeDatabase } from '../../2-services/2-database/database.mjs';

const DEFAULT_EXPIRED_PRAYER_REQUEST_QUERY_LIMIT = 5;

export const notifyLongTermExpiredPrayerRequestsBatch = async ():Promise<void> => {

  let done = false;
  const limit = DEFAULT_EXPIRED_PRAYER_REQUEST_QUERY_LIMIT;
  let cursor = 0;
  while (done === false) {
      const result = await DB_SELECT_EXPIRED_PRAYER_REQUESTS_PAGINATED(1, limit, cursor);
      console.log(result);

      await notifyExpiringPrayerRequestOwners(result);

      if (result.length < limit) done = true;
      else cursor = result[result.length-1].prayerRequestID;

  }
}

export const answerShortTermExpiredPrayerRequestsBatch = async ():Promise<void> => {
  let done = false;
  const limit = DEFAULT_EXPIRED_PRAYER_REQUEST_QUERY_LIMIT;
  let cursor = 0;
  while (done === false) {
      const result = await DB_SELECT_EXPIRED_PRAYER_REQUESTS_PAGINATED(0, limit, cursor);
      
      console.log(result);
      await DB_UPDATE_RESOLVE_PRAYER_REQUEST_BATCH(result.map((prayerRequest) => prayerRequest.prayerRequestID));

      if (result.length < limit) done = true;
      else cursor = result[result.length-1].prayerRequestID;

  }
}


const notifyExpiringPrayerRequestOwners = async (expiredPrayerRequests:ExpiredPrayerRequest[]):Promise<boolean> => {

    for (const expiredPrayerRequest of expiredPrayerRequests) {
        await sendNotificationMessage([expiredPrayerRequest.requestorID], `Your prayer request '${expiredPrayerRequest.topic}' is expiring soon!`, new Map<string, string>().set('prayerRequestID', expiredPrayerRequest.requestorID.toString()));
    }

    return true;
}

export const answerAndNotifyPrayerRequests = async () => {
  
  await initializeDatabase();

  await notifyLongTermExpiredPrayerRequestsBatch();
  //await answerShortTermExpiredPrayerRequestsBatch(); 

    try {  
      const response = {
        //statusCode: statusCode,
        body: JSON.stringify('Hello from Lambda!'),
      };
  
      return response;
  
    } catch(e) {
      console.log(e);
      const response = {
        statusCode: 500,
        body: JSON.stringify(e.message),
      };
      return response;
    }
};

await answerAndNotifyPrayerRequests();