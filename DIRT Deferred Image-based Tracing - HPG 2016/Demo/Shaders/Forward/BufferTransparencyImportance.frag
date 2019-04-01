// Variable k-Buffer using Importance Maps (Short Eurographics 2017)
// https://diglib.eg.org/handle/10.2312/egsh20171005
// Authors: A.A. Vasilakis, K. Vardis, G. Papaioannou, K. Moustakas
// Fragment shader for the importance estimation pass

#version 420 core

#define KBUFFER_SIZE			__ABUFFER_LOCAL_SIZE__
#define KBUFFER_SIZE_1n			KBUFFER_SIZE - 1

in vec2 TexCoord;
uniform sampler2D sampler_prev;
uniform float uniform_max_estimated_layers;
uniform bvec4 uniform_metrics_enabled;
#define FOV 0
#define DEPTH 1
#define FRESNEL 2
#define NOISE 3

layout(binding = 0, r32ui)				readonly uniform uimage2D		image_layers;
layout(binding = 1, offset = 0)				  uniform atomic_uint		total_importance_layers;
layout(binding = 2, rgba32f)			writeonly uniform image2D		image_importance;

uint getLayers() { return imageLoad     (image_layers, ivec2(gl_FragCoord.xy)).r;}
void storeImportance(vec4 val) { imageStore(image_importance, ivec2(gl_FragCoord.xy), val);}

#include "random_number.h"

void main(void)
{
	vec4 importance = vec4(0);
	
	uint total_layers = getLayers();
	if (total_layers == 0u) 
	{
		storeImportance(vec4(0,0,0,0));
		return;
	}
	
	// Noise (jittering)
	float rand = rand1n(17 * (gl_FragCoord.xy))-0.5;
	float range = 0.1;
	float I_noise = range * rand;
	if (uniform_metrics_enabled[NOISE] == false) 
		I_noise = 0;

	// FOViated importance (0.0 -> 1.0)
	vec2 texSize = textureSize(sampler_prev, 0).xy * 0.5;
	float I_fov = length(gl_FragCoord.xy - texSize) / (length(texSize));
	I_fov = pow(I_fov, 3);
	I_fov = 1 - clamp(I_fov, 0.0, 1.0);	
	if (uniform_metrics_enabled[FOV] == false) 
		I_fov = 1;
	
	// Depth Complexity (0.5 -> 1)
	float I_layered = min(1.0, total_layers / uniform_max_estimated_layers);
	float a = 0.25;
	I_layered = (1-a) * I_layered + a;
	if (uniform_metrics_enabled[DEPTH] == false) 
		I_layered = 1;

	// Prev Fresnel importance (0.5 -> 1.0)
	vec4 prev = texture(sampler_prev, TexCoord.st);
	prev.x = clamp(prev.x, 0, 1);
	prev.x = 1-prev.x;
	float I_prev = 1 - 0.5 * (prev.x * prev.x * prev.x * prev.x * prev.x);
	I_prev = clamp(I_prev, 0.5, 1.0);
	if (uniform_metrics_enabled[FRESNEL] == false) 
		I_prev = 1;

	// Total (0.0 -> 1.0)
	float I = I_fov * I_layered * I_prev + I_noise;

	float scalar = 50.0;
	importance.x = clamp(I, 0.01, 1.0) * scalar;
	importance.y = I_fov;
	importance.z = I_layered;
	importance.w = I_prev;
	uint int_importance = uint(floor(importance.x+0.5));
	
	storeImportance(importance);
	for (int i = 0; i < int_importance && i < 50; ++i)
		atomicCounterIncrement(total_importance_layers);	
}
