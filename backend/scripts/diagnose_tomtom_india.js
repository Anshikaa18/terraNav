/**
 * Live TomTom India coverage diagnostic. Does not print the API key.
 * Run: node backend/scripts/diagnose_tomtom_india.js
 */
const path = require('path');
// Match the backend runtime configuration, regardless of the current directory.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');

const locations = [
  { name: 'Raipur GE Road (major)', lat: 21.2514, lng: 81.6296 },
  { name: 'Raipur Samta Colony (smaller street)', lat: 21.2456, lng: 81.6360 },
  { name: 'Raipur Ring Road', lat: 21.2158, lng: 81.6659 },
  { name: 'Bengaluru MG Road (major)', lat: 12.9756, lng: 77.6066 }
];
const key = process.env.TOMTOM_API_KEY;
const flowUrl = process.env.TOMTOM_FLOW_URL || 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const incidentsUrl = process.env.TOMTOM_INCIDENTS_URL || 'https://api.tomtom.com/traffic/services/5/incidentDetails';

function result(name, status, details) { return { location: name, status, checkedAt: new Date().toISOString(), ...details }; }

async function check(location) {
  try {
    const flowResponse = await axios.get(flowUrl, { params: { key, point: `${location.lat},${location.lng}`, unit: 'KMPH' }, timeout: 7000 });
    const flow = flowResponse.data?.flowSegmentData || {};
    let incidentStatus = null;
    let incidentCount = null;
    try {
      const margin = 0.01;
      const incidentResponse = await axios.get(incidentsUrl, { params: {
        key, bbox: `${location.lng - margin},${location.lat - margin},${location.lng + margin},${location.lat + margin}`,
        fields: '{incidents{type,properties{id,lastReportTime,magnitudeOfDelay}}}', language: 'en-US', timeValidityFilter: 'present'
      }, timeout: 7000 });
      incidentStatus = incidentResponse.status;
      incidentCount = Array.isArray(incidentResponse.data?.incidents) ? incidentResponse.data.incidents.length : null;
    } catch (error) {
      incidentStatus = error.response?.status || error.code || 'error';
    }
    const currentSpeed = Number.isFinite(Number(flow.currentSpeed)) ? Number(flow.currentSpeed) : null;
    const freeFlowSpeed = Number.isFinite(Number(flow.freeFlowSpeed)) ? Number(flow.freeFlowSpeed) : null;
    const usable = currentSpeed !== null && freeFlowSpeed !== null && freeFlowSpeed > 0;
    return result(location.name, flowResponse.status, {
      usableTrafficObservation: usable,
      currentSpeedKmh: currentSpeed, freeFlowSpeedKmh: freeFlowSpeed,
      speedRatio: usable ? Number((currentSpeed / freeFlowSpeed).toFixed(3)) : null,
      confidence: Number.isFinite(Number(flow.confidence)) ? Number(flow.confidence) : null,
      currentTravelTimeSeconds: Number.isFinite(Number(flow.currentTravelTime)) ? Number(flow.currentTravelTime) : null,
      freeFlowTravelTimeSeconds: Number.isFinite(Number(flow.freeFlowTravelTime)) ? Number(flow.freeFlowTravelTime) : null,
      roadClosure: flow.roadClosure === true,
      responseFields: Object.keys(flow).sort(),
      observationTimestamp: null, // Flow API payload has no guaranteed per-segment timestamp.
      freshness: usable ? 'fetched-now; provider does not expose per-segment timestamp in this response' : 'unavailable',
      incidentStatus, incidentCount
    });
  } catch (error) {
    return result(location.name, error.response?.status || error.code || 'error', {
      usableTrafficObservation: false,
      errorType: error.response?.status === 401 || error.response?.status === 403 ? 'AUTH_ERROR' : error.response?.status === 429 ? 'RATE_LIMIT' : error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'PROVIDER_ERROR',
      message: error.response?.data?.detailedError?.message || error.message
    });
  }
}

async function main() {
  if (!key) {
    console.log(JSON.stringify({ status: 'blocked', reason: 'TOMTOM_API_KEY is not configured; no network requests were made.', locations: locations.map(x => x.name) }, null, 2));
    process.exitCode = 2;
    return;
  }
  const results = [];
  for (const location of locations) results.push(await check(location));
  console.log(JSON.stringify({ provider: 'TomTom Traffic Flow API / Incidents API', results }, null, 2));
  if (!results.some(item => item.usableTrafficObservation)) process.exitCode = 1;
}
main();
