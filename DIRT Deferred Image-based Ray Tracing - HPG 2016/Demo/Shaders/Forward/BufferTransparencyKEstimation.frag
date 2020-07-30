// Variable k-Buffer using Importance Maps (Short Eurographics 2017)
// https://diglib.eg.org/handle/10.2312/egsh20171005
// Authors: A.A. Vasilakis, K. Vardis, G. Papaioannou, K. Moustakas
// Fragment shader for the per-pixel k calculation pass

#version 430 core

#define KBUFFER_SIZE			__ABUFFER_LOCAL_SIZE__
#define KBUFFER_SIZE_1n			KBUFFER_SIZE - 1

in vec2 TexCoord;

layout(binding = 0, r32ui)				readonly uniform uimage2D		image_layers;
layout(binding = 1, offset = 0)				  uniform atomic_uint		total_k;
layout(binding = 2, rgba32f)			readonly uniform image2D		image_importance;
layout(binding = 3, r32ui)	    		coherent uniform uimage2D		image_k_map;
layout(binding = 4, offset = 0)				  uniform atomic_uint		total_layers;

uint	getLayers				() { return imageLoad     (image_layers		, ivec2(gl_FragCoord.xy)).r;}
float getImportance				() { return imageLoad     (image_importance	, ivec2(gl_FragCoord.xy)).r;}
void  setMaxPixelKValue			(uint val) { imageStore	  (image_k_map		, ivec2(gl_FragCoord.xy), uvec4(val, 0u, 0u, 0u));}

uniform uint uniform_total_importance;
uniform uint uniform_adaptive_k;
uniform int uniform_importance_enabled;

#define __IMPORTANCE_K_BUFFER__ 
// FIXED_K_BUFFER is enabled if kbuffer type is array-based
// DYNAMIC_K_BUFFER is enabled if kbuffer allocation method is dynamic (continuous) and importance is disabled
// IMPORTANCE_K_BUFFER is enabled if kbuffer allocation method is dynamic (continuous) and importance is enabled

void main(void)
{
	float importance = getImportance();
	if (importance <= 0) return;
	
#ifdef IMPORTANCE_K_BUFFER
	float total_buffer_size = imageSize(image_importance).x * imageSize(image_importance).y * float(uniform_adaptive_k) * 1;
	uint k_xy = uint(importance) * uint(total_buffer_size);
	k_xy /= uniform_total_importance;
	uint k = clamp(uint(k_xy), 0, getLayers());
#endif

#ifdef FIXED_K_BUFFER
	// uses all the available layers (for comparison)
	uint k_xy = getLayers();	
	// clamp k to the passed adaptive value (this can cause overflow)
	uint k = clamp(uint(k_xy), 0, uniform_adaptive_k);
#endif

#ifdef DYNAMIC_K_BUFFER
	// set k to either the predefined k or the current number of layers (manually adjusting this can cause overflow)
	uint k = min(uniform_adaptive_k, getLayers());
#endif

	setMaxPixelKValue(k);

	for (int i = 0; i < k; ++i)
		atomicCounterIncrement(total_k);
}
