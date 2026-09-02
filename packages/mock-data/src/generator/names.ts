/**
 * Curated fictional names reflecting Scottish caseloads: Scottish, Polish, Pakistani, Syrian and Chinese.
 * None of these combinations is intended to identify a real person.
 */
export interface NamePool {
  origin: 'scottish' | 'polish' | 'pakistani' | 'syrian' | 'chinese';
  female: string[];
  male: string[];
  family: string[];
  /** Languages an interpreter may be needed for. */
  languages: string[];
  weight: number;
}

export const NAME_POOLS: NamePool[] = [
  {
    origin: 'scottish',
    female: ['Morag', 'Eilidh', 'Kirsty', 'Fiona', 'Isla', 'Shona', 'Catriona', 'Ailsa', 'Mhairi', 'Jean', 'Agnes', 'Senga', 'Lorna', 'Elspeth', 'Rhona', 'Kayleigh', 'Chloe', 'Lily', 'Marion', 'Ishbel', 'Nicola', 'Lauren', 'Erin', 'Skye', 'Iona', 'Freya', 'Ellie', 'Sophie', 'Ava', 'Jessica', 'Kirsten', 'Annette', 'Margaret', 'Elizabeth', 'Wilma', 'Sheila', 'Carol', 'Linda', 'Donna', 'Tracy'],
    male: ['Callum', 'Ewan', 'Fraser', 'Hamish', 'Lachlan', 'Angus', 'Gregor', 'Alasdair', 'Ruaridh', 'Iain', 'Archie', 'Finlay', 'Rory', 'Kenny', 'Stewart', 'Ryan', 'Derek', 'Aiden', 'Mason', 'Logan', 'Jack', 'Lewis', 'Harris', 'Oliver', 'Brodie', 'Kyle', 'Craig', 'Scott', 'Gary', 'Tam', 'Willie', 'Jim', 'Robert', 'Douglas', 'Malcolm', 'Alan', 'Brian', 'Colin', 'Gordon', 'Neil'],
    family: ['Fraser', 'Docherty', 'Kerr', 'Muir', 'Boyle', 'Grant', 'Reid', 'MacLeod', 'Campbell', 'Stewart', 'Robertson', 'Wilson', 'Thomson', 'Anderson', 'Morrison', 'Buchanan', 'Gillespie', 'McIntyre', 'Cunningham', 'Wallace', 'Ferguson', 'Sinclair', 'Gunn', 'Munro', 'Baird', 'Drummond', 'Lennox', 'Kilgour', 'Paterson', 'McCulloch', 'Rennie', 'Sneddon', 'Torrance', 'Weir', 'Lindsay', 'Ogilvie', 'Rankin', 'Milne', 'Cairns', 'Duffy'],
    languages: [],
    weight: 62,
  },
  {
    origin: 'polish',
    female: ['Agnieszka', 'Katarzyna', 'Magdalena', 'Zofia', 'Ewa', 'Aleksandra', 'Joanna', 'Monika', 'Natalia', 'Weronika'],
    male: ['Tomasz', 'Piotr', 'Marek', 'Krzysztof', 'Pawel', 'Mateusz', 'Jakub', 'Lukasz', 'Bartosz', 'Michal'],
    family: ['Nowak', 'Kowalski', 'Wisniewski', 'Wojcik', 'Kaminski', 'Lewandowski', 'Zielinski', 'Szymanski', 'Dabrowski', 'Mazur'],
    languages: ['Polish'],
    weight: 12,
  },
  {
    origin: 'pakistani',
    female: ['Ayesha', 'Fatima', 'Zainab', 'Hina', 'Sana', 'Rabia', 'Nadia', 'Saima', 'Iqra', 'Mariam'],
    male: ['Imran', 'Faisal', 'Bilal', 'Usman', 'Adeel', 'Kamran', 'Tariq', 'Hassan', 'Zeeshan', 'Arif'],
    family: ['Hussain', 'Akhtar', 'Malik', 'Iqbal', 'Rashid', 'Mahmood', 'Chaudhry', 'Sheikh', 'Anwar', 'Butt'],
    languages: ['Urdu', 'Punjabi'],
    weight: 10,
  },
  {
    origin: 'syrian',
    female: ['Rania', 'Layla', 'Nour', 'Hala', 'Dima', 'Rima', 'Ghada', 'Salma', 'Amal', 'Yara'],
    male: ['Omar', 'Khaled', 'Samir', 'Yousef', 'Bassam', 'Tarek', 'Rami', 'Adnan', 'Fadi', 'Hani'],
    family: ['Haddad', 'Khoury', 'Saleh', 'Nasser', 'Abbas', 'Hamdan', 'Darwish', 'Karim', 'Mansour', 'Barakat'],
    languages: ['Arabic'],
    weight: 8,
  },
  {
    origin: 'chinese',
    female: ['Mei', 'Ling', 'Xiu', 'Hua', 'Yan', 'Jing', 'Wei', 'Fang', 'Lan', 'Ying'],
    male: ['Wei', 'Jun', 'Ming', 'Hao', 'Lei', 'Jian', 'Bo', 'Feng', 'Tao', 'Kai'],
    family: ['Chen', 'Wong', 'Li', 'Zhang', 'Liu', 'Huang', 'Lam', 'Cheung', 'Ng', 'Wu'],
    languages: ['Cantonese', 'Mandarin'],
    weight: 8,
  },
];

export const STAFF_GIVEN = ['Janet', 'Paul', 'Moira', 'Graeme', 'Anne', 'Stuart', 'Helen', 'Ross', 'Karen', 'David', 'Lesley', 'Mark', 'Claire', 'Andrew', 'Fiona', 'Ewan', 'Priya', 'Amira', 'Sunita', 'Kasia', 'Louise', 'Gavin', 'Heather', 'Niall', 'Sadia', 'Jason'];
export const STAFF_FAMILY = ['Kerr', 'Mackay', 'Ross', 'Paterson', 'Dunlop', 'Hendry', 'Gilmour', 'Sharif', 'Nowicka', 'Chan', 'Blair', 'Mowat', 'Findlay', 'Laird', 'Morton', 'Hepburn', 'Rae', 'Cowan', 'Muirhead', 'Sutherland', 'Brodie', 'Malik', 'Haddad', 'Kennedy'];
