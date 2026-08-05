#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
global.document = {readyState:"loading", addEventListener(){}, querySelector(){return null;}, querySelectorAll(){return [];}};
global.window = {};
global.localStorage = {getItem(){return null;}, setItem(){}};
require("../js/site-v13-4.js");
const t = global.__TREND_PILOT_SEARCH_TEST__;
assert.ok(t, "search test API missing");

// Corrections across departments.
const corrections = {
  makup:"makeup", tshrit:"tshirt", lapotp:"laptop", headfone:"headphone",
  staionery:"stationery", fitnes:"fitness", kichen:"kitchen", babby:"baby",
  sofware:"software", wholsale:"wholesale", accesories:"accessories",
  petts:"pets", multimter:"multimeter", camra:"camera", pritner:"printer"
};
for (const [raw, expected] of Object.entries(corrections)) {
  assert.equal(t.normalizeQuery(raw).query, expected, raw);
}
assert.equal(t.normalizeQuery("make up").query, "makeup");
assert.equal(t.normalizeQuery("Make-up").query, "makeup");
assert.equal(t.inferAudience("boys cotton T-shirt"), "kids");
assert.equal(t.inferAudience("women running shoes"), "women");

const segments = [
  ["apparel","t-shirts","men"], ["apparel","t-shirts","kids"], ["apparel","dress-shirts","men"],
  ["footwear","running-shoes","all"], ["footwear","running-shoes","kids"],
  ["beauty-care","lip-makeup","all"], ["beauty-care","skin-care","all"],
  ["office-school","calculators","all"], ["office-school","school-bags","all"],
  ["computers","laptops","all"], ["phones-tablets","smartphones","all"],
  ["sports-outdoors","yoga-pilates","all"], ["baby-kids","strollers","kids"],
  ["toys-games","building-toys","kids"], ["software","video-editor","all"],
  ["business-sourcing","private-label","all"], ["pet-supplies","pet-feeder","all"],
  ["tools","multimeters","all"], ["home-kitchen","kitchen-appliances","all"],
  ["smart-home","smart-locks","all"], ["automotive","wireless-carplay-adapter","all"]
].map(([group,family,audience])=>({key:`${group}|${family}|${audience}`,group,family,audience,count:1,pages:1,files:["/x.json"]}));
const manifest = {
  segments,
  familyTaxonomy:{
    makeup:{label:"Makeup (all)",members:["lip-makeup"]},
    "kids-all":{label:"Kids (all)",members:["strollers","building-toys","t-shirts","running-shoes"]}
  },
  familyAliases:{
    "lipstick":"lip-makeup", "skin care":"skin-care", "scientific calculator":"calculators",
    "school backpack":"school-bags", "laptop":"laptops", "running shoe":"running-shoes",
    "video editing":"video-editor", "private label":"private-label", "pet feeder":"pet-feeder",
    "multimeter":"multimeters", "air fryer":"kitchen-appliances", "smart lock":"smart-locks"
  },
  groups:[
    {id:"office-school",label:"Office, school & stationery",aliases:["school supplies","office supplies"]},
    {id:"sports-outdoors",label:"Sports & outdoors",aliases:["fitness","sports"]}
  ],
  scopeGroups:{kids:["baby-kids","toys-games","apparel","footwear","bags-accessories","office-school"]},
  tokenRoutes:{}
};
t.state.manifest = manifest;

assert.equal(t.inferFamily("matte lipstick", manifest), "lip-makeup");
assert.equal(t.inferFamily("scientific calculator", manifest), "calculators");
assert.deepEqual(t.inferGroups("school supplies", manifest), ["office-school"]);

// Category-only searches.
let plan=t.makePlan("beauty",manifest,"beauty");
assert.deepEqual(plan.groups,["beauty-care"]);
assert.equal(plan.family,"");
plan=t.makePlan("school",manifest,"school");
assert.deepEqual(plan.groups,["office-school"]);

// A family outside the broad scope is added rather than discarded.
plan=t.makePlan("running shoes",manifest,"sports");
assert.ok(plan.groups.includes("sports-outdoors"));
assert.ok(plan.groups.includes("footwear"));
assert.ok(plan.segmentKeys.includes("footwear|running-shoes|all"));

// Kids scope implies kids audience and can reach kids clothing/footwear.
plan=t.makePlan("tshirt",manifest,"kids");
assert.equal(plan.audience,"kids");
assert.ok(plan.groups.includes("apparel"));
assert.ok(plan.segmentKeys.includes("apparel|t-shirts|kids"));

// Strict family and contamination guards.
const shirtPlan={groups:["apparel"],families:["t-shirts"],family:"t-shirts",audience:"men",intentTokens:[],q:"mens tshirts"};
assert.equal(t.strictProductMatch({group:"apparel",family:"t-shirts",audience:"men",name:"Men Graphic T-Shirt Cotton Tee",category:"Clothing"},shirtPlan),true);
assert.equal(t.strictProductMatch({group:"apparel",family:"t-shirts",audience:"men",name:"Men Formal Button Up Dress Shirt",category:"Shirts"},shirtPlan),false);
const phonePlan={groups:["phones-tablets"],families:["smartphones"],family:"smartphones",audience:"",intentTokens:[],q:"smartphone"};
assert.equal(t.strictProductMatch({group:"phones-tablets",family:"smartphones",audience:"all",name:"5G Android Smartphone",category:"Phones"},phonePlan),true);
assert.equal(t.strictProductMatch({group:"phones-tablets",family:"smartphones",audience:"all",name:"Protective Case for Smartphone",category:"Phone case"},phonePlan),false);

console.log("TrendPilot V13.4.1 browser search tests passed");
