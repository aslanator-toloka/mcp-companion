function log(state, text, data = {}) {
  state.log.push({ round: state.round, text, ...data });
}

module.exports = log;
