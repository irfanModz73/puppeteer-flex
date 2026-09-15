const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'ads.yahoo.com',
  'advertising.com',
  'adnxs.com',
  'adsrvr.org',
  'criteo.com',
  'criteo.net',
  'outbrain.com',
  'taboola.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'appnexus.com',
  'casalemedia.com',
  'smartadserver.com',
  'adform.net',
  'adroll.com',
  'mathtag.com',
  'turn.com',
  'sitescout.com',
  'bidswitch.net',
  'sharethrough.com',
  'teads.tv',
  'spotxchange.com',
  'spotx.tv',
  'yieldmo.com',
  'indexexchange.com',
  'sovrn.com',
  'gumgum.com',
  'media.net',
  'amazon-adsystem.com',
  'adsafeprotected.com',
  'moatads.com',
  'doubleverify.com',
  'integralads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'quantcast.com',
  'popcash.net',
  'popads.net',
  'propellerads.com',
  'exoclick.com',
  'trafficjunky.com',
  'juicyads.com',
  'adcash.com',
  'revcontent.com',
  'mgid.com',
  'zedo.com',
  'adblade.com',
  'bidvertiser.com',
  'infolinks.com',
  'clicksor.com',
];

class TrackerBlocker {
  constructor(page, options = {}) {
    this.page = page;
    this.enabled = false;
    this._attached = false;
    this._routes = [];
  }

  async attach() {
    if (this._attached) return;
    this._attached = true;

    this.page.blockTrack = async (enabled = true) => {
      this.enabled = !!enabled;
      if (this.enabled) {
        await this._installRoute();
      } else {
        await this._uninstallRoute();
      }
      return this.enabled;
    };
  }

  async _installRoute() {
    try {
      const client = await this.page.target().createCDPSession();
      await client.send('Fetch.enable', {
        patterns: [
          { urlPattern: '*', requestStage: 'Request' },
        ],
      });

      client.on('Fetch.requestPaused', async (event) => {
        if (!this.enabled) {
          try {
            await client.send('Fetch.continueRequest', {
              requestId: event.requestId,
            });
          } catch (_) {}
          return;
        }

        const url = event.request.url;
        let blocked = false;
        try {
          const host = new URL(url).hostname.toLowerCase();
          blocked = AD_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
        } catch (_) {}

        try {
          if (blocked) {
            await client.send('Fetch.failRequest', {
              requestId: event.requestId,
              errorReason: 'BlockedByClient',
            });
          } else {
            await client.send('Fetch.continueRequest', {
              requestId: event.requestId,
            });
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  async _uninstallRoute() {
    try {
      const client = await this.page.target().createCDPSession();
      await client.send('Fetch.disable');
    } catch (_) {}
  }
}

module.exports = TrackerBlocker;