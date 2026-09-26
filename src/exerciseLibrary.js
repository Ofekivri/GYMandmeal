// Exercise library: common gym exercises in Hebrew, each with a 3D animation
// (`demo`, an ExerciseDB V1 id, see demoUrl in session.js) or, where the free
// tier has none, a checked YouTube `video`. The editor suggests these names,
// and any exercise whose name matches one (or an alias) gets its demo when
// the workout is shown, so existing workouts need no migration.
// Adding one: find the id with `node scripts/demo.mjs "<keyword>"`, open the
// GIF to check it's the same variation, then add a line. Every id below was
// checked that way.

const demo = id => ({ demo: id });
const yt = id => ({ video: `https://www.youtube.com/watch?v=${id}` });
const E = (group, name, media, aliases = []) => ({ group, name, ...media, aliases });

export const EXERCISES = [
  E('חזה', 'לחיצת חזה במוט', demo('EIeI8Vf'), ['בנץ׳ פרס']),
  E('חזה', 'לחיצת חזה עם משקולות', demo('SpYC0Kp')),
  E('חזה', 'לחיצת חזה בשיפוע חיובי במוט', demo('3TZduzM')),
  E('חזה', 'לחיצת חזה בשיפוע חיובי עם משקולות', demo('ns0SIbU')),
  E('חזה', 'לחיצת חזה בשיפוע שלילי במוט', demo('GrO65fd')),
  E('חזה', 'לחיצת חזה במכונה', demo('T0yTjgW')),
  E('חזה', 'פרפר במכונה', demo('v3xmPAR'), ['פרפר במכונה או בכבלים', 'פק דק']),
  E('חזה', 'פרפר עם משקולות', demo('yz9nUhF')),
  E('חזה', 'קרוס אובר בכבלים', demo('0CXGHya')),
  E('חזה', 'שכיבות סמיכה', demo('I4hDWkc')),
  E('חזה', 'שכיבות סמיכה על הברכיים', demo('ZOuKWir')),
  E('חזה', 'מקבילים לחזה', demo('9WTm7dq')),

  E('גב', 'עליות מתח', demo('lBDjFxJ')),
  E('גב', 'עליות מתח בעזרת מכונה', demo('kiJ4Z2K')),
  E('גב', 'פולי עליון', demo('RVwzP10'), ['פולי עליון אחיזה רחבה']),
  E('גב', 'פולי עליון אחיזה צרה', demo('4c9BhzB')),
  E('גב', 'חתירה עם מוט בהטיה', demo('eZyBC3j')),
  E('גב', 'חתירה בכבל בישיבה', demo('fUBheHs'), ['חתירה בכבל בישיבה, אחיזה צרה']),
  E('גב', 'חתירה בכבל בישיבה, אחיזה רחבה', demo('qcY50ZD')),
  E('גב', 'חתירה עם משקולת ביד אחת', demo('C0MA9bC')),
  E('גב', 'חתירה במכונה', demo('7I6LNUG')),
  E('גב', 'חתירת T', demo('aaXr7ld')),
  E('גב', 'משיכת כבל בידיים ישרות', demo('x69MAlq'), ['פולאובר בכבל']),
  E('גב', 'דדליפט', demo('ila4NZS')),
  E('גב', 'פשיטת גב', demo('zhMwOwE'), ['היפר אקסטנשן']),
  E('גב', 'חתירה הפוכה', demo('bZGHsAZ'), ['אינברטד רואו']),

  E('כתפיים', 'לחיצת כתפיים בישיבה עם משקולות', demo('znQUdHY')),
  E('כתפיים', 'לחיצת כתפיים בעמידה עם מוט', demo('Kyd9Rz5'), ['מיליטרי פרס']),
  E('כתפיים', 'לחיצת כתפיים בעמידה עם משקולות', demo('A6wtbuL')),
  E('כתפיים', 'לחיצת כתפיים במכונה', demo('CggQhII')),
  E('כתפיים', 'ארנולד פרס', demo('Xy4jlWA')),
  E('כתפיים', 'הרחקה צידית עם משקולות', demo('DsgkuIt')),
  E('כתפיים', 'הרחקה צידית בכבל', demo('goJ6ezq')),
  E('כתפיים', 'הרמה קדמית עם משקולות', demo('3eGE2JC')),
  E('כתפיים', 'פרפר הפוך במכונה', demo('myfUsKf')),
  E('כתפיים', 'פרפר הפוך עם משקולות', demo('8DiFDVA')),
  E('כתפיים', 'פייס פול בכבל', demo('wqNPGCg'), ['פייס פול']),
  E('כתפיים', 'חתירה אנכית עם מוט', demo('83HoW9X'), ['אפרייט רואו']),
  E('כתפיים', 'חתירה אנכית בכבל', demo('cALKspW')),
  E('כתפיים', 'שראגס עם משקולות', demo('NJzBsGJ')),

  E('יד קדמית', 'כפיפת מרפקים עם מוט', demo('25GPyDY')),
  E('יד קדמית', 'כפיפת מרפקים עם מוט EZ', demo('6TG6x2w')),
  E('יד קדמית', 'כפיפת מרפקים עם משקולות', demo('NbVPDMW')),
  E('יד קדמית', 'כפיפת מרפקים לסירוגין', demo('BU15nH4')),
  E('יד קדמית', 'כפיפת פטישים', demo('slDvUAU'), ['כפיפת פטישים עם משקולות', 'האמר קרל']),
  E('יד קדמית', 'כפיפת מרפקים בכבל', demo('G08RZcQ')),
  E('יד קדמית', 'כפיפת מרפקים בספסל כומר', demo('hacCyUv'), ['פריצ׳ר קרל']),
  E('יד קדמית', 'כפיפת מרפקים בספסל כומר במכונה', demo('b6hQYMb')),
  E('יד קדמית', 'כפיפת מרפקים בשיפוע עם משקולות', demo('ae9UoXQ')),
  E('יד קדמית', 'כפיפת ריכוז', demo('gvsWLQw')),

  E('יד אחורית', 'פשיטת מרפקים בכבל (פושדאון)', demo('3ZflifB'), ['פושדאון']),
  E('יד אחורית', 'פושדאון עם חבל', demo('dU605di')),
  E('יד אחורית', 'פשיטת מרפקים מעל הראש בכבל', demo('2IxROQ1')),
  E('יד אחורית', 'פשיטת מרפקים מעל הראש עם משקולת', demo('kont8Ut')),
  E('יד אחורית', 'סקאל קראשר', demo('h8LFzo9')),
  E('יד אחורית', 'מקבילים ליד אחורית', demo('X6C6i5Y'), ['דיפס']),
  E('יד אחורית', 'לחיצת חזה באחיזה צרה', demo('J6Dx1Mu')),
  E('יד אחורית', 'קיקבק עם משקולת', demo('bQy2Eni')),
  E('יד אחורית', 'דיפס על ספסל', demo('VuoerH0')),

  E('רגליים', 'סקוואט עם מוט', demo('qXTaZnJ'), ['סקוואט']),
  E('רגליים', 'גובלט סקוואט', demo('yn8yg1r')),
  E('רגליים', 'סקוואט במכונת סמית׳', demo('NNoHCEA')),
  E('רגליים', 'האק סקוואט', demo('Qa55kX1')),
  E('רגליים', 'לחיצת רגליים', demo('2Qh2J1e'), ['לג פרס']),
  E('רגליים', 'פשיטת ברכיים במכונה', demo('my33uHU')),
  E('רגליים', 'כפיפת ברכיים בשכיבה', demo('17lJ1kr')),
  E('רגליים', 'כפיפת ברכיים בישיבה', demo('Zg3XY7P')),
  E('רגליים', 'לאנג׳ים עם משקולות', demo('RRWFUcw'), ['מכרעים עם משקולות']),
  E('רגליים', 'לאנג׳ים בהליכה', demo('IZVHb27')),
  E('רגליים', 'בולגרי ספליט סקוואט', demo('qx4fgX7'), ['בולגרי']),
  E('רגליים', 'עלייה על ספסל', demo('aXtJhlg'), ['סטפ אפ']),
  E('רגליים', 'דדליפט רומני עם משקולות', demo('rR0LJzx')),
  E('רגליים', 'דדליפט רומני עם מוט', demo('wQ2c4XD')),
  E('רגליים', 'דדליפט סומו', demo('KgI0tqW')),
  E('רגליים', 'הרמת עקבים בעמידה במכונה', demo('ykUOVze')),
  E('רגליים', 'הרמת עקבים בעמידה עם משקולות', demo('dPmaUaU')),
  E('רגליים', 'הרמת עקבים בישיבה', demo('bOOdeyc')),
  E('רגליים', 'גוד מורנינג', demo('XlZ4lAC')),
  E('רגליים', 'סקוואט במשקל גוף', yt('l83R5PblSMA')),

  E('ישבן', 'גשר ישבן', demo('u0cNiij')),
  E('ישבן', 'גשר ישבן עם מוט', demo('qKBpF7I')),
  E('ישבן', 'היפ ת׳ראסט', yt('EF7jXP17DPE')),
  E('ישבן', 'מכונת פתיחת רגליים', demo('CHpahtl'), ['אבדקשן']),
  E('ישבן', 'מכונת סגירת רגליים', demo('oHsrypV'), ['אדקשן']),
  E('ישבן', 'בעיטה לאחור בכבל', demo('Kpajagk'), ['קיקבק לישבן בכבל']),
  E('ישבן', 'הליכת צד עם גומייה', demo('O95afRA'), ['מונסטר ווק']),

  E('בטן', 'כפיפות בטן', demo('TFqbd8t'), ['קראנץ׳']),
  E('בטן', 'כפיפות בטן בכבל', demo('WW95auq')),
  E('בטן', 'כפיפות בטן הפוכות', demo('nCU1Ekp')),
  E('בטן', 'סיט אפ', demo('2gPfomN')),
  E('בטן', 'הרמת רגליים בשכיבה', demo('9IxJdtC')),
  E('בטן', 'הרמת רגליים בתלייה', demo('I3tsCnC')),
  E('בטן', 'הרמת רגליים בכיסא קפטן', demo('weoDEpH')),
  E('בטן', 'רוסיאן טוויסט', demo('fZFZ704')),
  E('בטן', 'מטפס הרים', demo('RJgzwny')),
  E('בטן', 'גלגל בטן', demo('NAgVB3t')),
  E('בטן', 'דד באג', demo('iny3m5y')),
  E('בטן', 'אופניים לבטן', demo('1ZFqTDN')),
  E('בטן', 'פלאנק', yt('mwlp75MS6Rg')),
  E('בטן', 'פלאנק צד', yt('44ND4bOB-T0')),

  E('קרדיו', 'הליכה בשיפוע', demo('rjiM4L3'), ['הליכון בשיפוע']),
  E('קרדיו', 'אופני כושר', demo('H1PESYI')),
  E('קרדיו', 'אליפטיקל', demo('rjtuP6X')),
  E('קרדיו', 'מכונת מדרגות', demo('j9Q5crt')),
  E('קרדיו', 'קפיצה בחבל', demo('e1e76I2')),
  E('קרדיו', 'ברפי', demo('dK9394r')),
  E('קרדיו', 'הליכת חקלאי', demo('qPEzJjA')),
];

// Loose match: case, spaces, and the Hebrew geresh/gershayim typed as ' or ".
export const libraryKey = name => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
  .replace(/[׳’`]/g, "'").replace(/[״“”]/g, '"');

const byKey = new Map();
for (const ex of EXERCISES) for (const n of [ex.name, ...ex.aliases]) byKey.set(libraryKey(n), ex);

// The library entry for an exercise name (or alias), or null.
export const findExercise = name => byKey.get(libraryKey(name)) || null;
