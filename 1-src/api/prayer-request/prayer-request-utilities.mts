import { PrayerRequest, PrayerRequestResponse, PrayerRequestTopicEnum } from "./prayer-request-types.mjs";


export const getPrayerRequest = (prayerRequestId: string):PrayerRequest => {
    //Database Query

    return {
        prayerRequestId: '202',
        userId: 100, 
        topic: PrayerRequestTopicEnum.SELF,
        description: "This is the description for the prayer request.",
        expiration: 100,
        prayerCount: 515,
        answered: false,
        comments: [],
    };
}

export const answerPrayerRequest = (prayerRequestId: string):PrayerRequest => {
    //Database Query

    return {
        ...getPrayerRequest(prayerRequestId),
        answered: true
    };
}

export const deletePrayerRequest = (prayerRequestId: string):Boolean => {
    //Database Query

    return true;
}

export const getUserPrayerRequestList = (userId: string):PrayerRequestResponse => {
    //Database Query

    return {
        prayerRequestList:[
            getPrayerRequest(userId),
            getPrayerRequest(userId),
            getPrayerRequest(userId),
        ]
    };
}

export const getCirclePrayerRequestList = (circleId: string):PrayerRequestResponse => {
    //Database Query

    return {
        prayerRequestList:[
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
            getPrayerRequest(circleId),
        ]
    };
}

