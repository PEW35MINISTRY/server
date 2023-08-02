import { PrayerRequestListItem, PrayerRequestTopicEnum } from "./prayer-request-types.mjs";

const PrayerRequestSampleList:PrayerRequestListItem[] = [
    {
        prayerRequestID: 1,
        sender: {
            userID: 1,
            firstName: 'Ethan',
            displayName: 'ethanjohnsrud',
            image: 'https://media.licdn.com/dms/image/C5603AQGeLrzr03WUbg/profile-displayphoto-shrink_400_400/0/1611782215091?e=1696464000&v=beta&t=oMDVyZ8h2NZbaXCHbpOIvXw2YdX0wXkh1F9EOii3IsA'
        },
        description: 'Please pray, coding Encouraging Prayer goes faster!',
        prayerCount: 365,
        tags: [PrayerRequestTopicEnum.GLOBAL]
    },
    {
        prayerRequestID: 2,
        sender: {
            userID: 4,
            firstName: 'Henry',
            displayName: 'henryalbertson',
            image: 'https://wp.usatodaysports.com/wp-content/uploads/sites/96/2016/04/cxx_hunter_henry_20_53280549.jpg'
        },
        description: 'Please pray, we win the football game Friday night and make it to the playoffs.',
        prayerCount: 17,
        tags: [PrayerRequestTopicEnum.SCHOOL]
    },
    {
        prayerRequestID: 3,
        sender: {
            userID: 5,
            firstName: 'Shelly',
            displayName: 'shellycooke',
            image: 'https://pbs.twimg.com/profile_images/506793282718810114/aeLwq7e9_400x400.jpeg'
        },
        description: 'Please pray for grandpa in the hospital.  He has been very sick for a long time and is in need of healing.  Also, pray for wisdom in the doctors decisions and procedures daily.',
        prayerCount: 255,
        tags: [PrayerRequestTopicEnum.FAMILY, PrayerRequestTopicEnum.HEALING]
    }
];

export default PrayerRequestSampleList;