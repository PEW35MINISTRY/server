// add all necessary imports here for all scripts. Remove at deployment
import { initializeDatabase } from "./2-services/2-database/database.mjs"
//import { answerAndNotifyPrayerRequests } from "./3-lambda/prayer-request/prayer-request-expired-script.mjs";

// initialize the databse
await initializeDatabase();

export const handler = async (event) => {
    //return await answerAndNotifyPrayerRequests();
}
