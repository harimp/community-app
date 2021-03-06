/**
 * Challenge spcific actions.
 */

import _ from 'lodash';
import { createActions } from 'redux-actions';
import { getService as getChallengesService } from 'services/challenges';
import { decodeToken } from 'tc-accounts';
import { getApiV2 } from '../services/api';

/**
 * String values of valid tab names.
 */
export const DETAIL_TABS = {
  DETAILS: 'details',
  REGISTRANTS: 'registrants',
  CHECKPOINTS: 'checkpoints',
  SUBMISSIONS: 'submissions',
  WINNERS: 'winners',
};

/**
 * Payload creator for CHALLENGE/FETCH_DETAILS_INIT action,
 * which marks that we are about to fetch details of the specified challenge.
 * If any challenge details for another challenge are currently being fetched,
 * they will be silently discarted.
 * @param {Number|String} challengeId
 * @return {String}
 */
function getDetailsInit(challengeId) {
  return _.toString(challengeId);
}

/**
 * Payload creator for CHALLENGE/FETCH_DETAILS_DONE action,
 * which fetch details of the specified challenge.
 * @param {Number|String} challengeId
 * @param {String} tokenV3
 * @param {String} tokenV2
 * @return {Promise}
 */
function getDetailsDone(challengeId, tokenV3, tokenV2) {
  const service = getChallengesService(tokenV3, tokenV2);
  const v3Promise = service.getChallenges({ id: challengeId })
    .then(res => res.challenges[0]);
  return Promise.all([
    v3Promise,
    v3Promise.then((v3) => {
      const type = v3.track.toLowerCase() || 'develop';
      return getApiV2(tokenV2).fetch(`/${type}/challenges/${challengeId}`)
        .then(res => res.json());
    }),
    tokenV3 && service.getUserChallenges(decodeToken(tokenV3).handle, {
      id: challengeId,
    }).then(res => res.challenges[0]),
  ]);
}

/**
 * Payload creator for the action that initializes loading of user's submissions
 * to the specified challenges. This action also cancels any previous unfinished
 * fetching of submissions.
 * @param {String} challengeId
 * @return {String}
 */
function getSubmissionsInit(challengeId) {
  /* As a safeguard, we enforce challengeId to be string (in case somebody
   * passes in a number, by mistake). */
  return _.toString(challengeId);
}

/**
 * Payload creator for the action that actually pulls from API user's
 * submissions to the specified challenge.
 * @param {String} challengeId
 * @param {String} tokenV2
 */
function getSubmissionsDone(challengeId, tokenV2) {
  return getApiV2(tokenV2)
    .fetch(`/challenges/submissions/${challengeId}/mySubmissions`)
    .then(response => response.json())
    .then(response => ({
      challengeId: _.toString(challengeId),
      submissions: response.submissions,
    }))
    .catch((error) => {
      const err = { challengeId: _.toString(challengeId), error };
      throw err;
    });
}

/**
 * Registers user for the challenge.
 * @param {Object} auth Auth section of Redux state.
 * @param {String} challengeId
 * @return {Promise}
 */
function registerDone(auth, challengeId) {
  return getChallengesService(undefined, auth.tokenV2)
    .register(challengeId)
    /* As a part of registration flow we silently update challenge details,
     * reusing for this purpose the corresponding action handler. */
    .then(() => getDetailsDone(challengeId, auth.tokenV3, auth.tokenV2));
}

/**
 * Unregisters user for the challenge.
 * @param {Object} auth Auth section of Redux state.
 * @param {String} challengeId
 * @return {Promise}
 */
function unregisterDone(auth, challengeId) {
  return getChallengesService(undefined, auth.tokenV2)
    .unregister(challengeId)
    /* As a part of unregistration flow we silently update challenge details,
     * reusing for this purpose the corresponding action handler. */
    .then(() => getDetailsDone(challengeId, auth.tokenV3, auth.tokenV2));
}

/**
 * Initiates loading of challenge results. Any loading of results initiated
 * before will be silently discarted.
 * @param {Number|String} challengeId
 * @return {String}
 */
function loadResultsInit(challengeId) {
  return _.toString(challengeId);
}

/**
 * Loads challenge results. Challenge ID should match with the one previously
 * passed to loadResultsInit(..), otherwise results will be silently discarted.
 * @param {Object} auth
 * @param {Number|String} challengeId
 * @param {String} type
 * @return {Object}
 */
function loadResultsDone(auth, challengeId, type) {
  return getApiV2(auth.tokenV2)
    .fetch(`/${type}/challenges/result/${challengeId}`)
    .then(response => response.json())
    .then(response => ({
      challengeId: _.toString(challengeId),
      results: response.results,
    }));
}

function fetchCheckpointsDone(tokenV2, challengeId) {
  const endpoint = `/design/challenges/checkpoint/${challengeId}`;
  return getApiV2(tokenV2).fetch(endpoint)
    .then((response) => {
      if (response.status !== 200) {
        throw response.status;
      } else {
        return response.json();
      }
    })
    .then((response) => {
      // Expanded key is used for UI expand/collapse.
      response.checkpointResults.forEach((checkpoint, index) => {
        response.checkpointResults[index].expanded = false;
      });
      return {
        challengeId: Number(challengeId),
        checkpoints: response,
      };
    })
    .catch(error => ({
      error,
      challengeId: Number(challengeId),
    }));
}

/**
 * Payload creator for the action that updates progress percent
 * @param {Number} percent content uploaded
 * @return {Number} percent uploaded
 */
function uploadProgress(percent) {
  return percent;
}

/**
 * Payload creator for the action that actually performs submission operation.
 * @param {String} tokenV3
 * @param {String} tokenV2
 * @param {String} submissionId
 * @param {Object} body Data to submit.
 * @param {String} track Competition track of the challenge where we submit.
 * @return
 */
function submitDone(tokenV3, tokenV2, submissionId, body, track, progress) {
  return getChallengesService(tokenV3, tokenV2)
    .submit(body, submissionId, track, progress);
}


/**
 * Payload creator for the action that initializes submission operation.
 */
function submitInit() {
}

/**
 * Payload creator for the action that resets submission operation.
 */
function submitReset() {
}

/**
 * Toggles checkpoint feedback. If second argument is provided, it
 * will just open / close the checkpoint depending on its value being
 * true or false.
 * @param {Number} id
 * @param {Boolean} open
 * @return {Object}
 */
function toggleCheckpointFeedback(id, open) {
  return { id, open };
}

export default createActions({
  CHALLENGE: {
    FETCH_CHECKPOINTS_INIT: _.noop,
    FETCH_CHECKPOINTS_DONE: fetchCheckpointsDone,
    GET_DETAILS_INIT: getDetailsInit,
    GET_DETAILS_DONE: getDetailsDone,
    GET_SUBMISSIONS_INIT: getSubmissionsInit,
    GET_SUBMISSIONS_DONE: getSubmissionsDone,
    LOAD_RESULTS_INIT: loadResultsInit,
    LOAD_RESULTS_DONE: loadResultsDone,
    REGISTER_INIT: _.noop,
    REGISTER_DONE: registerDone,
    SELECT_TAB: _.identity,
    SUBMIT_DONE: submitDone,
    SUBMIT_INIT: submitInit,
    UPLOAD_PROGRESS: uploadProgress,
    SUBMIT_RESET: submitReset,
    TOGGLE_CHECKPOINT_FEEDBACK: toggleCheckpointFeedback,
    UNREGISTER_INIT: _.noop,
    UNREGISTER_DONE: unregisterDone,
  },
});
