// The engine must never depend on the machine's timezone. Unless TZ is already set
// (see `npm run test:tz`), run under Chatham: +12:45/+13:45 with its own DST dates,
// so any accidental use of local time shows up as a wrong answer.
module.exports = async () => {
  process.env.TZ = process.env.TZ || 'Pacific/Chatham';
};
