import { ProfilePartnerResponse, ProfilePublicResponse, ProfileResponse, StageEnum } from "./profile-types.mjs";


export const getPublicProfile = (userId: String):ProfilePublicResponse => {
    //Database Query

    return {
        userId: '101', 
        userRole: 'Student', 
        displayName: 'Ethan', 
        profileImage: 'Profile Image coming soon.',
        dob: 100,
        gender: 'Male',
        circleIdList: [],
        proximity: 0,
    };
}

export const getProfile = (userId: String):ProfileResponse => {
    //Database Query

    return {
        ...getPublicProfile(userId),
        email: 'email.com',
        phone: '555-555-5555',
        zipCode: '55555',
        stage: StageEnum.LEARNING,
        quietTime: 500
    };
}

export const getPartnerProfile = (userId: String):ProfilePartnerResponse => {
    //Database Query

    return {
        ...getPublicProfile(userId),
        zipCode: '55555', 
        stage: StageEnum.LEARNING,
        quietTime: 500,
        pendingPrayerRequestList: [],
        answeredPrayerRequestList: [],
        messageList: []
    };
}

