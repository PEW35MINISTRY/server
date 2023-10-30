import { CircleEventListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';


const getDateDaysFuture = (days: number = 14, hours: number = 12):Date => {
    let date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, 0, 0, 0);
    return date;
}

//getEventsSampleList
export default (circleID:number):CircleEventListItem[] => [
    {
        eventID: 1,
        circleID: circleID,
        name: 'Prayer Walk',
        description: 'Meet near the front door.',
        startDate: getDateDaysFuture(0, 15).toISOString(),
        endDate: getDateDaysFuture(0, 17).toISOString(),
        image: 'https://mounthopechurch.org/wp-content/uploads/2020/09/Prayer-Walk_1402x739.jpg'
    },
    {
        eventID: 2,
        circleID: circleID,
        name: 'Fall Retreat',
        description: 'Weekend at camp, full of activities, special speakers, and new friends!',
        startDate: getDateDaysFuture(3, 18).toISOString(),
        endDate: getDateDaysFuture(5, 12).toISOString(),
        image: 'https://www.themanual.com/wp-content/uploads/sites/9/2021/10/camping-in-the-fall.jpg?resize=1200%2C630&p=1'
    },
    {
        eventID: 3,
        circleID: circleID,
        name: 'Christmas Party',
        description: 'Delicious food and gift exchange!',
        startDate: getDateDaysFuture(75, 18).toISOString(),
        endDate: getDateDaysFuture(75, 21).toISOString(),
        image: 'https://uvmbored.com/wp-content/uploads/2022/12/throw-a-fun-christmas-party.jpg'
    }
];