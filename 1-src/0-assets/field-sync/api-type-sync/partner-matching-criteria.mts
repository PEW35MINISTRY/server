export type PartnerMatchingRange<T = number> = {
    min: T;
    max: T;
}


/* VALIDATIONS */
//Verifies all integers are covered between acceptable range
const validateRangeCoverage = (name:string, lookup:Record<number, PartnerMatchingRange>, min:number, max:number):void => {
    for(let value = min; value <= max; value++) {
        if(lookup[value] === undefined)
            throw new Error(`Partner matching criteria invalid: ${name} missing ${value}`);

        if(lookup[value].min > lookup[value].max)
            throw new Error(`Partner matching criteria invalid: ${name} ${value} min exceeds max`);
    }
}

//Verifies matching criteria from both perspectives are logically consistent (ex: if 13 can match 15, then 15 should be able to match 13)
const validateSymmetricalFairness = (name:string, lookup:Record<number, PartnerMatchingRange>, min:number, max:number):void => {
    for(let value = min; value <= max; value++) {
        const range = lookup[value];

        for(let match = range.min; match <= range.max; match++) {
            const matchRange = lookup[match];

            if(matchRange === undefined)
                continue;

            if(value < matchRange.min || value > matchRange.max)
                throw new Error(`Partner matching criteria invalid: ${name} ${value} can match ${match}, but ${match} cannot match ${value}`);
        }
    }
}



/* WALK LEVEL MATCHING CRITERIA */
const PARTNER_WALK_LEVEL_RANGE_LOOKUP:Record<number, PartnerMatchingRange> = {
    1: {min: 1, max: 4},
    2: {min: 1, max: 5},
    3: {min: 1, max: 6},
    4: {min: 1, max: 7},
    5: {min: 2, max: 8},
    6: {min: 3, max: 9},
    7: {min: 4, max: 10},
    8: {min: 5, max: 10},
    9: {min: 6, max: 10},
    10: {min: 7, max: 10}
}

validateRangeCoverage('walk level', PARTNER_WALK_LEVEL_RANGE_LOOKUP, 1, 10);
validateSymmetricalFairness('walk level', PARTNER_WALK_LEVEL_RANGE_LOOKUP, 1, 10);

export const calculatePartnerMatchingWalkLevel = (walkLevel:number):PartnerMatchingRange => {
    return PARTNER_WALK_LEVEL_RANGE_LOOKUP[walkLevel] || {min: walkLevel, max: walkLevel};
}


/* AGE MATCHING CRITERIA */
const PARTNER_AGE_RANGE_LOOKUP:Record<number, PartnerMatchingRange> = {
    13: {min: 13, max: 15},
    14: {min: 13, max: 16},
    15: {min: 13, max: 17},
    16: {min: 14, max: 18},
    17: {min: 15, max: 18},
    18: {min: 16, max: 21},
    19: {min: 18, max: 23},
    20: {min: 18, max: 24},
    21: {min: 18, max: 25},
    22: {min: 19, max: 26},
    23: {min: 19, max: 26},
    24: {min: 20, max: 27},
    25: {min: 21, max: 29},
    26: {min: 22, max: 30},
    27: {min: 24, max: 32},
    28: {min: 25, max: 34},
    29: {min: 25, max: 36},
    30: {min: 26, max: 38},
}

validateRangeCoverage('age', PARTNER_AGE_RANGE_LOOKUP, 13, 30);
validateSymmetricalFairness('age', PARTNER_AGE_RANGE_LOOKUP, 13, 30);

const calculatePartnerMatchingAge = (dateOfBirth:Date):PartnerMatchingRange => {
    const age = calculateAge(dateOfBirth);

    if(age < 13) //Below Range
        return {min: age, max: age};
    else if(age > 30) //Above Range
        return {min: 31, max: 100};
    else 
        return PARTNER_AGE_RANGE_LOOKUP[age] || {min: age, max: age};
}

export const calculatePartnerMatchingDOB = (dateOfBirth:Date):PartnerMatchingRange<Date> => {
    return getDateOfBirthRange(calculatePartnerMatchingAge(dateOfBirth));
}



/* Local Utilities */
const calculateAge = (dateOfBirth:Date):number => {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDelta = today.getMonth() - dateOfBirth.getMonth();

    if(monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateOfBirth.getDate()))
        age--;

    return age;
}

const getDateOfBirthRange = (ageRange:PartnerMatchingRange):PartnerMatchingRange<Date> => {
    const minDateOfBirth:Date = new Date();
    minDateOfBirth.setFullYear(minDateOfBirth.getFullYear() - ageRange.max - 1);
    minDateOfBirth.setDate(minDateOfBirth.getDate() + 1);

    const maxDateOfBirth:Date = new Date();
    maxDateOfBirth.setFullYear(maxDateOfBirth.getFullYear() - ageRange.min);

    return {min: minDateOfBirth, max: maxDateOfBirth};
}
