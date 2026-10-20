import assert from "node:assert/strict";
import test from "node:test";
import { awsProfile, emptyBucket, emptyBucketArgs } from "./lib/r2-s3.js";

test("emptyBucketArgs は profile を付けて再帰削除する", () => {
  assert.deepEqual(emptyBucketArgs("bk"), ["s3", "rm", "s3://bk", "--recursive", "--profile", "r2"]);
  assert.deepEqual(emptyBucketArgs("bk", "other").slice(-2), ["--profile", "other"]);
});

test("awsProfile は R2_AWS_PROFILE を優先し、無ければ r2", () => {
  assert.equal(awsProfile({}), "r2");
  assert.equal(awsProfile({ R2_AWS_PROFILE: "mine" }), "mine");
});

test("emptyBucket は差し替えた実行関数に引数を渡す", () => {
  const calls = [];
  emptyBucket("bk", { run: (a) => calls.push(a), profile: "p" });
  assert.deepEqual(calls, [["s3", "rm", "s3://bk", "--recursive", "--profile", "p"]]);
});
