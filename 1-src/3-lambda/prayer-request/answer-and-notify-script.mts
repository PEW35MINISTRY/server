import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { ExpiredPrayerRequestListItem } from "../../1-api/5-prayer-request/prayer-request-types.mjs";
import { sendNotificationMessage, sendNotificationPairedMessage } from "../../1-api/8-notification/notification-utilities.mjs";
import { DB_SELECT_EXPIRED_PRAYER_REQUESTS_PAGINATED, DB_UPDATE_RESOLVE_PRAYER_REQUEST_BATCH } from "../../2-services/2-database/queries/prayer-request-queries.mjs";

const DEFAULT_EXPIRED_PRAYER_REQUEST_QUERY_LIMIT = 5 ;

export const answerPrayerRequests = async (nestedPrayerRequests:ExpiredPrayerRequestListItem[][]):Promise<boolean> => {
    for (const prayerRequestList in nestedPrayerRequests) {
        const prayerRequests = prayerRequestList as unknown as ExpiredPrayerRequestListItem[];
        const result = await DB_UPDATE_RESOLVE_PRAYER_REQUEST_BATCH(prayerRequests.map((prayerRequest) => prayerRequest.prayerRequestID))

        if (result === false) return false;
    }

    return true;
}

export const getLongTermExpiredPrayerRequestsBatch = async () => {
    const prayerRequests:ExpiredPrayerRequestListItem[][] = [];
    let done = false;
    const limit = DEFAULT_EXPIRED_PRAYER_REQUEST_QUERY_LIMIT;
    let offset = 0;
    while (done === false) {
        const result = await DB_SELECT_EXPIRED_PRAYER_REQUESTS_PAGINATED(1, limit, offset);
        console.log(result);
        prayerRequests.push(result);

        offset += result.length;

        if (result.length < limit) done = true;
    }

    return prayerRequests;
}

export const getShortTermExpiredPrayerRequestsBatch = async () => {
    const prayerRequests:ExpiredPrayerRequestListItem[][] = [];
    let done = false;
    const limit = DEFAULT_EXPIRED_PRAYER_REQUEST_QUERY_LIMIT;
    let offset = 0;
    while (done === false) {
        const result = await DB_SELECT_EXPIRED_PRAYER_REQUESTS_PAGINATED(0, limit, offset);
        console.log(result);
        prayerRequests.push(result);

        offset += result.length;

        if (result.length < limit) done = true;
    }

    return prayerRequests;
}

export const notifyExpiringPrayerRequestOwners = async (nestedPrayerRequests:ExpiredPrayerRequestListItem[][]):Promise<boolean> => {

    for (const prayerRequestList in nestedPrayerRequests) {
        const expiredPrayerRequestList = prayerRequestList as unknown as ExpiredPrayerRequestListItem[];
        for (const prayerRequest in expiredPrayerRequestList) {
            const expiredPrayerRequest = prayerRequest as unknown as ExpiredPrayerRequestListItem;
            await sendNotificationMessage([expiredPrayerRequest.requestorID], `Your prayer request '${expiredPrayerRequest.topic}' is expiring soon!`);
        }
    }

    return true;
}

export const answerAndNotifyPrayerRequests = async () => {
  
    try {
      // delete any non long-term prayer requests
      const shortTermExpiredPrayerRequests = await getShortTermExpiredPrayerRequestsBatch();
      //const shortTermResult = await answerPrayerRequests(shortTermExpiredPrayerRequests);
  
      const longTermExpiredPrayerRequests = await getLongTermExpiredPrayerRequestsBatch();
      //const longTermResult = await notifyExpiringPrayerRequestOwners(longTermExpiredPrayerRequests);
  
      //const statusCode = shortTermResult === true && longTermResult === true ? 200 : 503;
      console.log(shortTermExpiredPrayerRequests, longTermExpiredPrayerRequests);
  
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