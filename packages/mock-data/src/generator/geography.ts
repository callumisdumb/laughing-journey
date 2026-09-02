/** Fictional geography for Clydeshore. Postcodes use the unallocated QX prefix. */
export interface Town {
  name: string;
  postcodeArea: string;
  streets: string[];
  primarySchool: string;
  secondarySchool: string;
  gpPractice: string;
}

export const TOWNS: Town[] = [
  { name: 'Ardvale', postcodeArea: 'QX1', streets: ['Brae Wynd', 'Kirk Loan', 'Castle Vennel', 'Mill Gait', 'Harbour Brae', 'Cross Wynd', 'Meadow Loan'], primarySchool: 'Ardvale Primary', secondarySchool: 'Kilbrannan Academy', gpPractice: 'Portnellan Medical Practice' },
  { name: 'Kilbrannan', postcodeArea: 'QX2', streets: ['Station Brae', 'Abbey Wynd', 'Cannon Loan', 'Weavers Gait', 'Burnside Vennel', 'Seaforth Loan'], primarySchool: "St Ninian's Primary", secondarySchool: 'Kilbrannan Academy', gpPractice: 'Braeside Health Centre' },
  { name: 'Portnellan', postcodeArea: 'QX3', streets: ['Shore Loan', 'Quay Wynd', 'Fishers Gait', 'Cathkin Brae', 'Salt Vennel'], primarySchool: 'Ardvale Primary', secondarySchool: 'Kilbrannan Academy', gpPractice: 'Portnellan Medical Practice' },
  { name: 'Glenmoray', postcodeArea: 'QX4', streets: ['Moray Loan', 'Glen Wynd', 'Tinkers Gait', 'Larch Brae', 'Distillery Vennel'], primarySchool: "St Ninian's Primary", secondarySchool: 'Kilbrannan Academy', gpPractice: 'Braeside Health Centre' },
  { name: 'Braeside', postcodeArea: 'QX5', streets: ['Hill Loan', 'Brae Wynd', 'Rowan Gait', 'Craig Vennel', 'Loch Brae', 'Schoolhouse Loan'], primarySchool: 'Ardvale Primary', secondarySchool: 'Kilbrannan Academy', gpPractice: 'Braeside Health Centre' },
];

export const HOSPITAL = 'Clydeshore Royal Infirmary';
export const CARE_HOME = 'Rowanbank Care Home';
export const WOMENS_AID = "Clydeshore Women's Aid";
export const ADVOCACY = 'Clydeshore Advocacy';

export function postcode(area: string, rnd: () => number): string {
  const digit = 1 + Math.floor(rnd() * 9);
  const letters = 'ABDEFGHJLNPQRSTUWXYZ';
  const a = letters[Math.floor(rnd() * letters.length)] ?? 'A';
  const b = letters[Math.floor(rnd() * letters.length)] ?? 'B';
  return `${area} ${digit}${a}${b}`;
}
