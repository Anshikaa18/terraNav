const axios = require('axios');
const { BadRequestError, ServiceUnavailableError } = require('../_lib/errors');
const logger = require('../_lib/logging');

const TOMTOM_RASTER_URL = 'https://api.tomtom.com/map/1/tile/basic/main';

function validTileCoordinate(z, x, y) {
  const zoom = Number(z);
  const tileX = Number(x);
  const tileY = Number(y);
  const limit = 2 ** zoom;
  return Number.isInteger(zoom) && zoom >= 0 && zoom <= 22 &&
    Number.isInteger(tileX) && Number.isInteger(tileY) &&
    tileX >= 0 && tileY >= 0 && tileX < limit && tileY < limit;
}

async function tomtomTile(req, res, next) {
  const { z, x, y } = req.params;
  if (!validTileCoordinate(z, x, y)) {
    return next(new BadRequestError('Invalid map tile coordinates'));
  }
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return next(new ServiceUnavailableError('TomTom Maps is not configured'));

  try {
    const response = await axios.get(`${TOMTOM_RASTER_URL}/${z}/${x}/${y}.png`, {
      params: { key }, responseType: 'arraybuffer', timeout: 7000
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return res.status(200).send(Buffer.from(response.data));
  } catch (error) {
    const status = error.response?.status;
    logger.warn(`TomTom map tile request failed: ${status || error.code || error.message}`);
    return next(new ServiceUnavailableError(
      status === 401 || status === 403 ? 'TomTom Maps credential is unauthorized' : 'TomTom Maps tile is temporarily unavailable'
    ));
  }
}

module.exports = { tomtomTile, validTileCoordinate };
