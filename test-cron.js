import cron from 'node-cron';

// Get current time and add 2 minutes
const now = new Date();
const testTime = new Date(now.getTime() + 2 * 60000); // 2 minutes from now

const hours = String(testTime.getHours()).padStart(2, '0');
const minutes = String(testTime.getMinutes()).padStart(2, '0');

console.log(`Current time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
console.log(`Test scheduled for: ${hours}:${minutes}`);

const cronExpression = `${testTime.getMinutes()} ${testTime.getHours()} * * *`;
console.log(`Cron expression: ${cronExpression}`);

let triggered = false;

const task = cron.schedule(cronExpression, () => {
  triggered = true;
  console.log(`\n✅ CRON TASK TRIGGERED AT ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}:${String(new Date().getSeconds()).padStart(2, '0')}`);
  console.log('SUCCESS: The scheduled task fired at the correct time!');
  process.exit(0);
});

console.log('Waiting for cron task to trigger...\n');

// Safety timeout after 5 minutes
setTimeout(() => {
  if (!triggered) {
    console.log('\n❌ TIMEOUT: Cron task did not trigger within 5 minutes');
    task.stop();
    task.destroy();
    process.exit(1);
  }
}, 5 * 60000);
