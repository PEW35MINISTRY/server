import { PrayerRequest, PrayerRequestResponse, PrayerRequestTopicEnum } from "./prayer-request-types.mjs";


export const getPrayerRequest = (prayerRequestID: string):PrayerRequest => {
    //Database Query

    return {
        prayerRequestID: 202,
        // userID: 100, 
        tags: [PrayerRequestTopicEnum.SELF],
        description: "This is the description for the prayer request.",
        expiration: new Date(),
        prayerCount: 515,
        answered: false,
        comments: [],
    };
}

export const answerPrayerRequest = (prayerRequestID: string):PrayerRequest => {
    //Database Query

    return {
        ...getPrayerRequest(prayerRequestID),
        answered: true
    };
}

export const deletePrayerRequest = (prayerRequestID: string):Boolean => {
    //Database Query

    return true;
}

export const getUserPrayerRequestList = (userID: string):PrayerRequestResponse => {
    //Database Query

    return {
        prayerRequestList:[
            getPrayerRequest(userID),
            getPrayerRequest(userID),
            getPrayerRequest(userID),
        ]
    };
}

export const getCirclePrayerRequestList = (circleID: string):PrayerRequestResponse => {
    //Database Query

    return {
        prayerRequestList:[
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
            getPrayerRequest(circleID),
        ]
    };
}

