#define DEBUG_SHADER_ENABLE
#ifndef DEBUG_BINDING_LOCATION
#define DEBUG_BINDING_LOCATION __DEBUG_LOCATION__
#endif // DEBUG_BINDING_LOCATION
#ifdef DEBUG_SHADER_ENABLE
layout(binding = DEBUG_BINDING_LOCATION, rgba32f)  coherent uniform image2D image_debug;
int debug_iter = 0;
bool isDebugFragmentCenterScreen(vec2 coord)
{
	return (ivec2(coord) == ivec2(imageSize(image_debug).xy * 0.5));
}
void storeDebug(vec2 coords, const vec4 value) { imageStore(image_debug, ivec2(coords), value); }
void storeDebug(ivec2 coords, const vec4 value) { imageStore(image_debug, coords, value); }
vec4 loadDebug(ivec2 coords) { return imageLoad(image_debug, coords); }
vec4 loadDebug(vec2 coords) { return imageLoad(image_debug, ivec2(coords)); }
void storeDebugIter(const vec4 value) { imageStore(image_debug, ivec2(++debug_iter), value); }
#endif //  DEBUG_SHADER_ENABLE