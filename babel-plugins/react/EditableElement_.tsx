/* eslint-disable */

// @eslint-ignore-file
// @ts-nocheck
import { cloneElement, PropsWithChildren, useContext } from "react";
import { EditableContext } from "./withEditableWrapper_";
import { Platform } from "react-native";

export type ElementTypes = "Text" | "View" | "Icon" | "Image" | "TouchableOpacity";

const isPrimitive = (item: any) => {
  if (Array.isArray(item)) return item.every((el) => isPrimitive(el));
  if (typeof item === "object")
    return Object.values(item).every((el) => isPrimitive(el));
  if (typeof item === "string") return true;
  if (typeof item === "number") return true;

  return false;
};

export const getType = (el: any): ElementTypes | undefined => {
  // Many icon libraries ultimately render a Text/View under the hood (e.g. @expo/vector-icons),
  // so we must detect icons BEFORE falling back to Text/View checks.
  const name =
    el?.type?.name ??
    el?.type?.displayName ??
    el?.type?.render?.name ??
    el?.type?.render?.displayName ??
    el?.type?.type?.name ??
    el?.type?.type?.displayName ??
    el?.type?.__proto__?.constructor?.name ??
    "";

  const lowerName = typeof name === "string" ? name.toLowerCase() : "";

  // Generic icon detection (covers IconSymbol, MaterialIcons, Ionicons, etc.)
  if (lowerName.includes("icon")) return "Icon";

  // Common iOS icon component (expo-symbols)
  if (name === "SymbolView") return "Icon";

  // Images
  if (name === "Image" || el?.type?.render?.displayName === "Image") return "Image";

  // Touchables
  if (lowerName.includes("touchable")) return "TouchableOpacity";
  if (el?.type?.type?.displayName === "TouchableOpacity") return "TouchableOpacity";

  // Text
  if (name === "Text" || el?.type?.render?.displayName === "Text") return "Text";

  // View (keep last so wrappers don't get caught as View)
  if (name === "View" || el?.type?.render?.displayName === "View") return "View";

  return undefined;
};

const toArray = (object: T | T[]): T[] => {
  if (Array.isArray(object)) return object;
  return [object];
};

export default function EditableElement_(_props: PropsWithChildren<any>) {
  const {
    editModeEnabled,
    selected,
    onElementClick,
    attributes: overwrittenProps,
    hovered,
    pushHovered,
    popHovered,
  } = useContext(EditableContext);

  const { children } = _props;
  const { props } = children;

  // If we are not running in the web the windows will causes
  // issues hence editable mode is not enabled.
  if (Platform.OS !== "web") {
    return cloneElement(children, props);
  }

  const type = getType(children);
  const __sourceLocation = props.__sourceLocation;
  const __trace = props.__trace;
  const __dataContext = props.__dataContext; // Capture data context from babel plugin
  const __contentSource = props.__contentSource; // NEW: Capture content source analysis

  // Base ID from trace (shared by all elements of same type/location)
  const baseId = __trace.join("");

  // Full unique ID - includes itemKey for dynamic elements in loops
  let id = baseId;
  if (__dataContext && __dataContext.itemKey) {
    id += `:${__dataContext.itemKey}`;
  }

  if (type === "Icon" && props.android_material_icon_name) {
    id += `:${props.android_material_icon_name}`;
  }

  // Determine if this element is "static" (not inside a data-driven loop)
  // Static elements should highlight all instances on hover
  // Dynamic elements (with dataContext) should only highlight the specific instance
  const isStaticElement = !__dataContext;

  // The ID used for hover comparison:
  // - Static elements: use baseId so all same-type elements highlight together
  // - Dynamic elements: use full id so only one specific instance highlights
  const hoverId = isStaticElement ? baseId : id;

  // Check if this is an editable dynamic element (like tab.label)
  // These are dynamic expressions that point to data we can update
  const isEditableDynamic = __contentSource &&
    __contentSource.type === 'dynamic' &&
    __contentSource.raw &&
    (__contentSource.raw.includes('.label') ||
      __contentSource.raw.includes('.name') ||
      __contentSource.raw.includes('.title'));

  // For images, check for URL-specific override first (prevents all list images from updating)
  let attributes = overwrittenProps?.[id] ?? {};
  if (type === "Image" && props.source?.uri) {
    const urlSpecificKey = `${id}:${props.source.uri}`;
    if (overwrittenProps?.[urlSpecificKey]) {
      attributes = overwrittenProps[urlSpecificKey];
    }
  }

  const editStyling =
    selected === id
      ? {
        outline: "1px solid blue",
      }
      : hovered === hoverId // Use hoverId for hover comparison (baseId for static, full id for dynamic)
        ? {
          outline: "1px dashed blue",
        }
        : {};

  const onClick = (ev: any) => {
    if (ev?.stopPropagation) ev.stopPropagation();
    if (ev?.preventDefault) ev.preventDefault();

    // Capture all relevant props based on element type
    const capturedProps: any = {
      style: { ...props.style },
      children: isPrimitive(props.children) ? props.children : undefined,
    };

    // Capture type-specific props
    if (type === "Image") {
      capturedProps.source = props.source;
    }

    if (type === "Icon") {
      capturedProps.size = props.size;
      capturedProps.color = props.color;
      capturedProps.tintColor = props.tintColor;
      capturedProps.android_material_icon_name = props.android_material_icon_name;
      capturedProps.ios_icon_name = props.ios_icon_name;
      capturedProps.name = props.name; // For SymbolView
      capturedProps.weight = props.weight; // For SymbolView
      capturedProps.emoji = props.emoji; // For IconCircle
      capturedProps.backgroundColor = props.backgroundColor; // For IconCircle
    }

    onElementClick({
      sourceLocation: __sourceLocation,
      id,
      type,
      trace: __trace,
      props: capturedProps,
      dataContext: __dataContext, // Include data context for data-driven updates
      contentSource: __contentSource, // NEW: Pass content source analysis to editor
      isEditableDynamic, // Flag for editable dynamic content like tab.label
    });
  };

  const editProps = {
    onMouseOver: () => pushHovered(hoverId), // Push hoverId (baseId for static, full id for dynamic)
    onMouseLeave: () => popHovered(hoverId),
    onClick: (ev) => onClick(ev),
    onPress: (ev) => onClick(ev),
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (ev) => onClick(ev),
    pointerEvents: "auto",
    ...(__dataContext && { 'data-context': JSON.stringify(__dataContext) }), // Add data context as attribute
  };

  if (type === "Text") {
    if (!editModeEnabled) return children;

    return cloneElement(children, {
      ...props,
      style: [...toArray(props.style), editStyling, attributes.style ?? {}],
      children: attributes.children ?? children.props.children,
      ...editProps,
    });
  }

  if (type === "View") {
    if (!editModeEnabled) return children;

    return cloneElement(children, {
      ...props,
      style: [...toArray(props.style), editStyling, attributes.style ?? {}],
      children: children.props.children,
      ...editProps,
    });
  }

  if (type === "TouchableOpacity") {
    if (!editModeEnabled) return children;

    return cloneElement(children, {
      ...props,
      style: [...toArray(props.style), editStyling, attributes.style ?? {}],
      children: children.props.children,
      ...editProps,
    });
  }

  if (type === "Icon") {
    if (!editModeEnabled) return children;

    return cloneElement(children, {
      ...props,
      style: [...toArray(props.style), editStyling, attributes.style ?? {}],
      size: attributes.size ?? props.size,
      color: attributes.color ?? props.color,
      tintColor: attributes.tintColor ?? props.tintColor,
      android_material_icon_name: attributes.android_material_icon_name ?? props.android_material_icon_name,
      ios_icon_name: attributes.ios_icon_name ?? props.ios_icon_name,
      name: attributes.name ?? props.name,
      weight: attributes.weight ?? props.weight,
      emoji: attributes.emoji ?? props.emoji,
      backgroundColor: attributes.backgroundColor ?? props.backgroundColor,
      children: children.props.children,
      ...editProps,
    });
  }

  if (type === "Image") {
    if (!editModeEnabled) return children;

    return cloneElement(children, {
      ...props,
      style: [...toArray(props.style), editStyling, attributes.style ?? {}],
      source: attributes.source ?? props.source,
      ...editProps,
    });
  }

  // Fallback for unknown types
  return children;
}
