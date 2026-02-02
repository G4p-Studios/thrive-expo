/* eslint-disable */

const EDITABLE_ELEMENTS = ["Text", "View", "TouchableOpacity", "Image"];
const PAGES_PATH = "/app/";
const EDITABLE_PATHS = ["/app/", "/components/"];
const OMITTED_PATHS = [
  "/node_modules/",
  "/components/IconSymbol.tsx",
  "/components/IconSymbol.ios.tsx",
  "/components/IconCircle.tsx",
];
// Generic function to check if an element name contains "icon" (case-insensitive)
const isIconElement = (elementName) => {
  return elementName && elementName.toLowerCase().includes('icon');
};

// Generic function to check if an element name contains "image" (case-insensitive)
const isImageElement = (elementName) => {
  return elementName && elementName.toLowerCase().includes('image');
};

module.exports = {
  EDITABLE_ELEMENTS,
  PAGES_PATH,
  EDITABLE_PATHS,
  OMITTED_PATHS,
  isIconElement,
  isImageElement,
};
