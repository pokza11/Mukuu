<template>
  <el-row :gutter="20">
    <el-col :span="4" class="hidden-smartphone hidden-tablet">
      <div>
        <HomeForm :searchOption="searchOption"></HomeForm>
        <el-form :inline="true" @submit.native.prevent size="mini" class="between">
          <el-form-item>
            <el-button type="danger" icon="el-icon-refresh" @click="clear">クリア</el-button>
          </el-form-item>
          <el-form-item>
            <Counter
              :current="current"
              :total="total"
              @changeCurrentNumber="changeCurrentNumber"
            ></Counter>
          </el-form-item>
        </el-form>
      </div>
      <SearchHistory :passSearchWord="passSearchWord"></SearchHistory>
      <SponsWide></SponsWide>
    </el-col>
    <el-col :span="12">
      <section class="infinite-list" v-infinite-scroll="load" infinite-scroll-disabled="canLoad">
        <TwitterSearchLink :searchWord="searchOption.searchWord" v-if="isEmpty" class="wrap">
          >
          <template v-slot:caption>
            <p>サイト内で見つかりませんでした。</p>
          </template>
        </TwitterSearchLink>
        <Post
          :post="post"
          :useDrawer="true"
          :useSticky="useSticky"
          mediaType="flex"
          :key="post._id"
          v-for="post in posts"
        ></Post>

        <TwitterSearchLink
          :searchWord="searchOption.searchWord"
          v-if="isLoadedLast"
          class="tail"
        ></TwitterSearchLink>
        <Loader :shouldShowLoader="shouldShowLoader"></Loader>
      </section>
    </el-col>
    <el-col :span="8" class="hidden-smartphone hidden-tablet">
      <UserDrawer></UserDrawer>
    </el-col>
  </el-row>
</template>

<style lang="scss" scoped>
section + section {
  margin-top: 0.5rem;
}

.twitter-search-word.tail {
  display: flex;
  padding: 0.25rem 1rem;
  border-radius: 1rem;
  border: 1px solid #d5d8db;
  background: #eee;
  cursor: pointer;
  word-break: break-word;
  transition: all 0.3s ease;
  font-size: 0.77rem; // 14px(this font-size) / 18px(root font-size)
  width: 100%;
  margin: 1rem 0;
  &:hover {
    background: white;
    border: 1px solid #eee;
  }
}
</style>

<script>
import SearchHistory from "@/container/SearchHistory.vue";
import UserDrawer from "@/container/UserDrawer.vue";

import HomeForm from "@/components/form/HomeForm.vue";
import Counter from "@/components/Counter.vue";
import Loader from "@/components/Loader.vue";
import Post from "@/components/Post.vue";
import SponsWide from "@/components/sponsor/SponsWide.vue";
// import Heatmap from "@/components/Heatmap.vue";
import TwitterSearchLink from "@/components/links/TwitterSearchLink.vue";

import { debounce } from "../plugins/util";
import post from "../api/post";

export default {
  name: "home",
  data() {
    return {
      skip: 0,
      limit: 5,
      total: 0,
      posts: [],
      isLoading: false,
      isEmpty: false,
      isCompletedLoading: false,
      canWatchSearchOption: false,
      searchOption: {
        searchWord: "",
        sort: "createdAtDesc",
        // from: "",
        to: ""
      },
      registerTimerID: null
    };
  },
  components: {
    Counter,
    Loader,
    HomeForm,
    // Heatmap,
    Post,
    SearchHistory,
    SponsWide,
    TwitterSearchLink,
    UserDrawer
  },
  computed: {
    canLoad() {
      return this.isCompletedLoading || this.isLoading;
    },
    shouldShowLoader() {
      return !this.isCompletedLoading && this.isLoading;
    },
    isLoadedLast() {
      return !this.shouldShowLoader && this.total !== 0 && this.total === this.current;
    },
    current() {
      return Math.min(this.skip, this.total);
    },
    useSticky() {
      return !this.searchOption.searchWord;
    }
  },
  watch: {
    searchOption: {
      handler() {
        if (this.canWatchSearchOption) {
          this.search({});
        }
      },
      deep: true
    }
  },
  created() {
    this.search = debounce(({ skip }) => {
      this.isCompletedLoading = false;
      this.isEmpty = false;
      this.skip = skip || 0;
      this.posts = [];
      Promise.all([this.fetchCount(), this.load()]);
    }, 100).bind(this);
  },
  mounted() {
    this.restoreSearchOptionFromQueryString();
    this.fetchCount();
  },
  methods: {
    clear() {
      this.searchOption = {
        searchWord: "",
        sort: "createdAtDesc",
        to: ""
      };
      this.skip = 0;
    },
    restoreSearchOptionFromQueryString() {
      const { searchWord, to, sort, skip } = this.$route.query;
      this.skip = skip ? Number(skip) : 0;
      this.searchOption = {
        searchWord: searchWord || "",
        to: !to ? "" : this.$dayjs(to).format("YYYY-MM-DD"),
        sort: sort || "createdAtDesc"
      };
    },
    storeSearchOptionToQueryString() {
      this.$router.push({
        query: {
          searchWord: this.searchOption.searchWord || "",
          to: !this.searchOption.to ? "" : this.$dayjs(this.searchOption.to).format("YYYY-MM-DD"),
          sort: this.searchOption.sort || "createdAtDesc",
          skip: this.skip
        }
      });
    },
    passSearchWord(searchWord) {
      this.searchOption.searchWord = searchWord;
    },
    setSearchOption(searchOption) {
      this.searchOption = searchOption;
    },
    changeCurrentNumber(skip) {
      this.search({ skip });
    },
    async fetchCount() {
      const { count } = await post.fetchCount({ ...this.searchOption });
      this.total = count;
    },
    async load() {
      this.isLoading = true;
      const { data, url } = await post.fetch({
        ...{ limit: this.limit, skip: this.skip },
        ...this.searchOption
      });
      this.canWatchSearchOption = true;
      if (data.length < 1) {
        if (this.posts.length < 1) {
          this.isEmpty = true;
        }
        this.isLoading = false;
        this.isCompletedLoading = true;
        return;
      }
      const expandedPosts = data.map((p, i) => {
        const ret = p;
        if (p.entities) ret.entities = JSON.parse(p.entities);
        this.addDividingFlag(i, data);
        return ret;
      });
      this.posts = [...this.posts, ...expandedPosts];
      this.storeSearchOptionToQueryString();
      this.skip += this.limit;
      this.isLoading = false;
      this.$ga.page({
        location: url
      });
    },
    addDividingFlag(index, posts) {
      if (!["createdAtAsc", "createdAtDesc"].includes(this.searchOption.sort)) {
        return;
      }
      const current = posts[index];
      if (index === 0) {
        if (this.posts.length === 0) {
          current.shouldShowDivider = true;
          return;
        }
        const preInAll = this.posts[this.posts.length - 1];
        if (preInAll.createdAt !== current.createdAt) {
          current.shouldShowDivider = true;
          return;
        }
        return;
      }
      const pre = posts[index - 1];
      if (pre.createdAt !== current.createdAt) {
        current.shouldShowDivider = true;
      }
    }
  }
};
</script>
