// One-time sign-in for the data scripts. Run it yourself in a terminal:
//   node scripts/login.mjs
// The password is typed here, never stored; only a refresh token is saved to
// ~/.config/gymandmeal/credentials.json (readable only by you).
import readline from 'node:readline';
import { signIn, saveCredentials, CRED_PATH } from './lib.mjs';

function ask(question, hidden = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = s => rl.output.write(s.startsWith(question) ? question : '');
    rl.question(question, answer => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const email = process.argv[2] || await ask('אימייל: ');
const password = await ask('סיסמה (לא תוצג): ', true);
try {
  const { refreshToken, uid } = await signIn(email, password);
  saveCredentials({ email, uid, refreshToken, savedAt: new Date().toISOString() });
  console.log(`✓ מחובר כ-${email}. המפתח נשמר ב-${CRED_PATH}`);
} catch (err) {
  console.error(`✗ ההתחברות נכשלה: ${err.message}`);
  process.exit(1);
}
