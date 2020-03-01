const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Twit = require('twit');
const TwitterAPI = require('node-twitter-api');
const dayjs = require('dayjs');

const { sleep } = require('../../lib/utils');
const ModelProviderFactory = require('../../models/modelProviderFactory');

const T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});
const twitterAPI = new TwitterAPI({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callback: process.env.TWITTER_CALLBACK_URL,
});

const SEARCH_INTERVAL = 1000 * 2;

const mapper = {
  user: user => {
    return {
      idStr: user.id_str,
      name: user.name,
      screenName: user.screen_name,
      url: user.url,
      description: user.description,
      protected: user.protected,
      followersCount: user.followers_count,
      friendsCount: user.friends_count,
      favouritesCount: user.favourites_count,
      statusesCount: user.statuses_count,
      profileBackgroundColor: user.profile_background_color,
      profileBackgroundImageUrl: user.profile_background_image_url_https,
      profileImageUrl: user.profile_image_url_https,
      profileBannerUrl: user.profile_banner_url,
      createdAt: dayjs(user.created_at.replace('+0000', '')).format(
        'YYYY-MM-DD hh:mm:ss',
      ),
      updatedAt: Date.now(),
    };
  },
  post: (tweet, postedBy) => {
    return {
      idStr: tweet.id_str,
      text: tweet.full_text,
      entities: JSON.stringify(tweet.extended_entities || tweet.entities),
      favoriteCount: tweet.favorite_count,
      retweetCount: tweet.retweet_count,
      createdAt: dayjs(tweet.created_at.replace('+0000', '')).format(
        'YYYY-MM-DD hh:mm:ss',
      ),
      postedBy: postedBy,
      updatedAt: Date.now(),
    };
  },
};

module.exports = class TweetCrawler {
  constructor() {}

  async traverseStatuses(searchParam) {
    await this.start('statuses', searchParam);
  }
  async traverseSearch(searchParam) {
    await this.start('search', searchParam);
  }
  async start(api, searchParam) {
    let maxId = 0;
    while (1) {
      try {
        const searchOption = Object.assign(searchParam, {
          max_id: maxId,
        });
        if (!searchParam.max_id) delete searchParam.max_id;
        const { statuses, search_metadata } = await this[api](searchOption);
        if (!statuses) return;
        const originalStatuses = statuses.filter(
          tweet => !tweet.retweeted_status,
        );
        console.log(originalStatuses.length);
        for (let tweet of originalStatuses) {
          tweet = this.expandUrl(tweet);
          if (
            tweet.full_text.toLowerCase().indexOf('#com3d2') === -1 ||
            (tweet.full_text.toLowerCase().indexOf('ux.getuploader.com') ===
              -1 &&
              tweet.full_text.toLowerCase().indexOf('drive.google.com') === -1)
          ) {
            continue;
          }

          const userProvider = ModelProviderFactory.create('user');
          const user = {
            query: { idStr: tweet.user.id_str },
            data: mapper.user(tweet.user),
            options: { new: true, upsert: true },
          };
          const dbUser = await userProvider.findOneAndUpdate(
            user.query,
            user.data,
            user.options,
          );
          const postProvider = ModelProviderFactory.create('post');
          const post = {
            query: { idStr: tweet.id_str },
            data: mapper.post(tweet, dbUser._id),
            options: { new: true, upsert: true },
          };
          await postProvider.findOneAndUpdate(
            post.query,
            post.data,
            post.options,
          );
        }
        const tailTweet = statuses[statuses.length - 1];
        if (!tailTweet) return;
        maxId = this.decStrNum(tailTweet.id_str);
        console.log(tailTweet.id_str);
        console.log(maxId);

        await sleep(SEARCH_INTERVAL);
        if (statuses.length <= 0) return;
      } catch (e) {
        console.log(e);
        return;
      }
    }
  }

  async search(option) {
    const param = Object.assign(
      {
        result_type: 'mixed',
        count: 200,
        tweet_mode: 'extended',
        include_entities: true,
      },
      option,
    );
    console.log(param);
    const { data } = await T.get('search/tweets', param);
    return data;
  }

  statuses(option) {
    return new Promise((resolve, reject) => {
      const param = Object.assign(
        {
          count: 200,
          tweet_mode: 'extended',
          include_entities: true,
        },
        option,
      );
      twitterAPI.getTimeline(
        'user_timeline',
        param,
        process.env.TWITTER_ACCESS_TOKEN,
        process.env.TWITTER_ACCESS_TOKEN_SECRET,
        (error, data, response) => {
          if (error) return reject(error);
          return resolve({ statuses: data });
        },
      );
    });
  }

  expandUrl(tweet) {
    if (!tweet) return tweet;

    if (tweet.entities && tweet.entities.urls) {
      tweet.entities.urls.map(urls => {
        tweet.full_text = tweet.full_text.replace(urls.url, urls.expanded_url);
      });
    }
    if (tweet.extended_entities && tweet.extended_entities.urls) {
      console.log(tweet.extended_entities.urls);
      tweet.extended_entities.urls.map(urls => {
        tweet.full_text = tweet.full_text.replace(urls.url, urls.expanded_url);
      });
    }
    if (tweet.user && tweet.user.entities) {
      if (
        tweet.user.description &&
        tweet.user.entities.description &&
        tweet.user.entities.description.urls
      ) {
        tweet.user.entities.description.urls.map(urls => {
          tweet.user.description = tweet.user.description.replace(
            urls.url,
            urls.expanded_url,
          );
        });
      }
      if (
        tweet.user.url &&
        tweet.user.entities.url &&
        tweet.user.entities.url.urls
      ) {
        tweet.user.entities.url.urls.map(urls => {
          tweet.user.url = tweet.user.url.replace(urls.url, urls.expanded_url);
        });
      }
    }
    return tweet;
  }

  decStrNum(n) {
    var i, result;
    n = n.toString();
    result = n;
    i = n.length - 1;
    while (i > -1) {
      if (n[i] === '0') {
        result = result.substring(0, i) + '9' + result.substring(i + 1);
        i--;
      } else {
        result =
          result.substring(0, i) +
          (parseInt(n[i], 10) - 1).toString() +
          result.substring(i + 1);
        return result;
      }
    }
    return result;
  }
};