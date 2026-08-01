// The second step filters by administrative district. Restaurant cards keep
// using the reviewed `areas` field for a more useful neighbourhood label.
const REGION_OPTIONS = [
  { id: "不限区域", label: "不限区域" },
  { id: "黄浦区", label: "黄浦区" },
  { id: "静安区", label: "静安区" },
  { id: "徐汇区", label: "徐汇区" },
  { id: "长宁区", label: "长宁区" },
  { id: "浦东新区", label: "浦东新区" },
  { id: "普陀区", label: "普陀区" },
  { id: "闵行区", label: "闵行区" },
  { id: "虹口区", label: "虹口区" }
];

module.exports = { REGION_OPTIONS };
