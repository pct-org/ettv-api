'use strict'

const debug = require('debug')
const https = require('https')
const { createGunzip } = require('zlib')
const { stringify } = require('querystring')
const { URL } = require('url')

const { name } = require('./package.json')

/**
 * The model for the torrent object.
 * @typedef {Object} Torrent
 * @property {!string} hash The hash of the torrent.
 * @property {!string} magnet The magnet of the torrent.
 * @property {!string} title The title of the torrent.
 * @property {!string} category The category of the torrent.
 * @property {!string} link The link of the torrent.
 */

/**
 * The default trackers to use for the hash.
 * @type {Array<string>}
 */
exports.defaultTrackers = [
  'udp%3A%2F%2Ftracker.coppersurfer.tk:6969/announce&',
  'udp%3A%2F%2F9.rarbg.to:2710/announce&',
  'udp%3A%2F%2F9.rarbg.me:2710/announce&',
  'udp%3A%2F%2FIPv6.open-internet.nl:6969/announce&',
  'udp%3A%2F%2Ftracker.internetwarriors.net:1337/announce&',
  'udp%3A%2F%2Ftracker.opentrackr.org:1337/announce&',
  'udp%3A%2F%2Fp4p.arenabg.com:1337/announce&',
  'udp%3A%2F%2Feddie4.nl:6969/announce&',
  'udp%3A%2F%2Fshadowshq.yi.org:6969/announce&',
  'udp%3A%2F%2Ftracker.leechers-paradise.org:6969/announce&',
  'udp%3A%2F%2Fexplodie.org:6969/announce&',
  'udp%3A%2F%2Ftracker.tiny-vps.com:6969/announce&',
  'udp%3A%2F%2Finferno.demonoid.pw:3391/announce&',
  'udp%3A%2F%2Fipv4.tracker.harry.lu:80/announce&',
  'udp%3A%2F%2Fpeerfect.org:6969/announce&',
  'udp%3A%2F%2Ftracker.pirateparty.gr:6969/announce&',
  'udp%3A%2F%2Ftracker.vanitycore.co:6969/announce&',
  'udp%3A%2F%2Fopen.stealth.si:80/announce&',
  'udp%3A%2F%2Ftracker.torrent.eu.org:451&',
  'udp%3A%2F%2Ftracker.zer0day.to:1337/announce&',
  'udp%3A%2F%2Ftracker.open-internet.nl:6969/announce'
]

/**
 * An ETTV API wrapper for NodeJS.
 * @type {EttvApi}
 */
module.exports = class EttvApi {

  /**
   * Create a new instance of the module.
   * @param {!Object} [options={}] - The options for the module.
   * @param {!string} [options.baseUrl=https://www.ettv.tv/] - The base url of
   * ettv.tv
   * @param {!Array<string>} [options.trackers=exprts.defaultTrackers] - A list
   * of trackers to add to the hahs of the torrents.
   */
  constructor({
    baseUrl = 'https://www.ettv.tv/',
    trackers = exports.defaultTrackers
  } = {}) {
    /**
     * The base url of ettv.
     * @type {string}
     */
    this._baseUrl = baseUrl
    /**
     * A list of trackers to add to the hahs of the torrents.
     * @type {Array<string>}
     */
    this._trackers = trackers
    /**
     * Show extra output.
     * @type {Function}
     */
    this._debug = debug(name)
  }

  /**
   * Make a GET request to ettv.tv.
   * @param {!string} endpoint - The endpoint to make the request to.
   * @returns {Promise<string, Error>} - The unzipped response from ettv.tv.
   */
  _get(endpoint) {
    return new Promise((resolve, reject) => {
      this._debug(`Making GET request to: '${endpoint}'`)
      return https.get(endpoint, res => {
        let data = ''

        res.pipe(createGunzip())
          .on('error', err => reject(new Error(err)))
          .on('data', chunk => {
            data += chunk
          })
          .on('end', () => resolve(data))
      })
    })
  }

  /**
   * Convert one chunk line to a more accessable JSON object.
   * @param {!Array<string>} chunk - The chunk to convert to an object.
   * @returns {Torrent} - The chunk converted to a torrent object.
   */
  _convertChunk(chunk) {
    const line = chunk.split('|')
    const headers = ['hash', 'title', 'category', 'link']

    const torrent = headers.reduce((acc, curr, i) => {
      acc[curr] = line[i]
      return acc
    }, {})

    const qs = stringify({
      xt: `urn:btih:${torrent.hash}`,
      dn: torrent.title,
      tr: this._trackers
    })
    torrent.magnet = `$magnet:?${qs}`

    return torrent
  }

  /**
   * Convert the database dump from ettv.tv to an array with Torrent objects.
   * @param {!string} res - The response of the database dump from ettv.tv.
   * @returns {Array<Torrent>} - The response converted to an array of torrent
   * object.
   */
  _convertToTorrents(res) {
    const lines = res.split('\n').filter(line => line !== '')
    return lines.map(this._convertChunk.bind(this))
  }

  /**
   * Get the database dump file from ettv.tv and convert it to an array of
   * Torrent object.
   * @param {!string} file - The name of the file to get. Can either be 'daily`
   * or 'full'.
   * @returns {Promise<Array<Torrent>, Error>} - The torrents from the database
   * dump.
   */
  _getFile(file) {
    const { href } = new URL(`dumps/ettv_${file}.txt.gz`, this._baseUrl)
    return this._get(href).then(this._convertToTorrents.bind(this))
  }

  /**
   * Get the daily database dump from ettv.tv.
   * @returns {Promise<Array<Torrent>, Error>} - The torrents from the database
   * dump.
   */
  getDaily() {
    return this._getFile('daily')
  }

  /**
   * Get the full database dump from ettv.tv.
   * @returns {Promise<Array<Torrent>, Error>} - The torrents from the database
   * dump.
   */
  getFull() {
    return this._getFile('full')
  }

}
