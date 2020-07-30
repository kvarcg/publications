//----------------------------------------------------//
//                                                    //
// This is a free rendering engine. The library and   //
// the source code are free. If you use this code as  //
// is or any part of it in any kind of project or     //
// product, please acknowledge the source and its	  //
// author.											  //
//                                                    //
// For manuals, help and instructions, please visit:  //
// http://graphics.cs.aueb.gr/graphics/               //
//                                                    //
//----------------------------------------------------//
#version 430 core

layout(location = 0) out vec4 out_color;
in vec2 TexCoord;

uniform sampler2D sampler_depth;
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_normal;
uniform sampler2D sampler_specular;
uniform sampler3D sampler_noise;
uniform sampler2D sampler_lighting;

uniform vec3 uniform_background_color;
uniform mat4 uniform_view;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_proj;
uniform mat4 uniform_pixel_proj;
uniform mat4 uniform_proj_inverse;
uniform int uniform_num_samples;
uniform vec2 uniform_samples_2d[200];
uniform float uniform_scene_length;
uniform vec2 uniform_near_far;
uniform vec3 uniform_clip_info;

#include "random_number.h"
#include "matrix_transformations.h"
#include "normal_compression.h"
#include "depth_reconstruction.h"

#define THICKNESS __THICKNESS__
#define NUM_SAMPLES __NUM_SAMPLES__
#define NUM_REPROJECTION_SAMPLES __NUM_REPROJECTION_SAMPLES__
#define __REPROJECTION__
#define __MARCHING_METHOD__
//#define WORLD_SPACE_MARCHING
//#define SCREEN_SPACE_MARCHING
// WORLD_SPACE_MARCHING
// SCREEN_SPACE_MARCHING

// both vectors are looking away from point X
vec3 calc_reflection_vector(vec3 V, vec3 N)
{
	return normalize((2.0*N*dot(N, V)) - V);
}

//#define NO_HIT
void swap(inout vec2 a, inout vec2 b) {
     vec2 temp = a;
     a = b;
     b = temp;
}

void swap(inout float a, inout float b) {
     float temp = a;
     a = b;
     b = temp;
}

// Morgan McGuire and Michael Mara, Efficient GPU Screen-Space Ray Tracing, Journal of Computer Graphics Techniques (JCGT), vol. 3, no. 4, 73-85, 2014
// Link: http://jcgt.org/published/0003/04/04/
// This is slightly modified, plus a couple of bug-fixes
float reconstructCSZ(float depthBufferValue) {
      return uniform_clip_info[0] / (depthBufferValue * uniform_clip_info[1] + uniform_clip_info[2]);
}

float distanceSquared(vec2 A, vec2 B) {
    A -= B;
    return dot(A, A);
}

float clipViewport(vec2 P0, vec2 P1, vec4 viewport)
{
	float alpha = 1.0;

	if (P1.y > viewport.w || P1.y < viewport.y)
	{
		alpha = (((P1.y > viewport.w) ? viewport.w : viewport.y) - P0.y) / (P1.y - P0.y);
	}
	
	if (P1.x > viewport.z || P1.x < viewport.x)
	{
		alpha = min(alpha, (((P1.x > viewport.z) ? viewport.z : viewport.x) - P0.x) / (P1.x - P0.x));
	}

	return alpha;
}

#define EPSILON 0.0000001
vec3 nearPlaneNormal= vec3(0,0,-1);
vec3 farPlaneNormal=vec3(0,0,1);
bool traceScreenSpaceRay
   (vec3          csOrigin, 
    vec3         csDirection,
	out float		hitDepth,
	out vec2		hitPixel) {
    //csDirection = normalize(vec3(0,1,-1));
	// clip with near and far plane
	// need to check also for ray parallel to planes to avoid dividing by near zero values (dot product ~= 0)
	vec2 denom = vec2(dot(csDirection, nearPlaneNormal), dot(csDirection, farPlaneNormal));

	float range = uniform_scene_length;
	float length_to_near = (denom.x != 0.0) ? -(dot(csOrigin, nearPlaneNormal) - uniform_near_far.x) / denom.x : range;
	length_to_near = (length_to_near < range && length_to_near > EPSILON) ? length_to_near : range;
	float length_to_far  = (denom.y != 0.0) ? -(dot(csOrigin, farPlaneNormal) + uniform_near_far.y) / denom.y : range;
	length_to_far = (length_to_far < range && length_to_far > EPSILON) ? length_to_far : range;
	float clipped_length = min(length_to_near, length_to_far);
	vec3 csEndPoint = csDirection * clipped_length + csOrigin;

    // Project into screen space
    vec4 H0 = uniform_pixel_proj * vec4(csOrigin, 1.0);
    vec4 H1 = uniform_pixel_proj * vec4(csEndPoint, 1.0);

    float k0 = 1.0 / H0.w;
    float k1 = 1.0 / H1.w;

    // Switch the original points to values that interpolate linearly in 2D
    vec4 Q_k0 = vec4(csOrigin * k0, k0);
    vec4 Q_k1 = vec4(csEndPoint * k1, k1);
	
	// Screen-space endpoints
    vec2 P0 = H0.xy * Q_k0.w;
    vec2 P1 = H1.xy * Q_k1.w;	

	// positive is away from the camera, negative towards
	int signdz = -int(sign(csEndPoint.z-csOrigin.z));
	
	// Initialize to off screen
    hitPixel = vec2(-1.0, -1.0);

    // Clipping to viewport	
	float offset = 0.5;
	ivec2 buffer_size = textureSize(sampler_depth, 0);
	vec4 viewport = vec4(offset,offset,buffer_size.x-offset, buffer_size.y-offset);
	float alpha = clipViewport(P0, P1, viewport);

	P1 = mix(P0, P1, alpha);
	Q_k1 = mix(Q_k0, Q_k1, alpha);

    vec2 delta = P1 - P0;

    // Permute so that the primary iteration is in x to reduce
    // large branches later
    bool permute = false;
	if (abs(delta.x) < abs(delta.y)) {
		// More-vertical line. Create a permutation that swaps x and y in the output
		permute = true;
		delta = delta.yx;
		P1 = P1.yx;
		P0 = P0.yx;        
	}
    
	// From now on, "x" is the primary iteration direction and "y" is the secondary one
    float stepDirection = sign(delta.x);
    float invdx = stepDirection / delta.x;
    vec2 dP = vec2(stepDirection, invdx * delta.y);
	if (abs(dP.x) < 1.0)
	{
		dP *= 1.0/dP.x;
	}
    // Track the derivatives of Q and k
	vec4 dQ_k = (Q_k1 - Q_k0) * invdx;

	vec2 sampling_seed = getSamplingSeed(TexCoord);
	float jitter = rand1n(sampling_seed) * 0.5 + 1;
	P0 += dP * jitter; 
	Q_k0 += dQ_k * jitter;
	delta = P1 - P0;
	
	float stride = 1.0;

    // P1.x is never modified after this point, so pre-scale it by 
    // the step direction for a signed comparison
    float end = P1.x * stepDirection;

	float len = length(delta);
	float max_samples = float(NUM_SAMPLES + 1);
	stride = max(len / max_samples, 1.0);
	dP *= stride; 
	dQ_k *= stride; 
	
	// Slide P from P0 to P1, (now-homogeneous) Q from Q0 to Q1, and k from k0 to k1
	// and move the first intersection to the next pixel instead of the current one
	float pixel_offset = 0.5;
	vec2  P = P0 + dP * pixel_offset; 
	vec4  Q_k = Q_k0 + dQ_k * pixel_offset;
	float prevZMaxEstimate = (Q_k0.z) / (Q_k0.w + dQ_k.w * pixel_offset);  	
	float rayZMax = prevZMaxEstimate;
	float rayZMin = prevZMaxEstimate;

	float rnd = 0.0;
	vec2 tP;
	bool has_hit = false;
	int stepCount = 0;
	float pndcZ = 0.0;
	for (; 
	P.x * stepDirection <= end && has_hit == false && stepCount < NUM_SAMPLES && rayZMax < 0; P += dP, Q_k += dQ_k, stepCount++)
	{	
		tP = P + dP * rnd;
		hitPixel.xy = permute ? tP.yx : tP;
		
        // The depth range that the ray covers within this loop
        // iteration.  Assume that the ray is moving in increasing z
        // and swap if backwards.  Because one end of the interval is
        // shared between adjacent iterations, we track the previous
        // value and then swap as needed to ensure correct ordering
        rayZMin = prevZMaxEstimate;

        // Compute the value at 1/2 pixel into the future
		rayZMax = (Q_k.z) / (Q_k.w + dQ_k.w *0.5); 

		// verification check
		// if during traversal towards the far plane we exit it (therefore the z sign is flipped)
		// simply replace the value with the far plane value for comparison
		if (signdz < 0 && rayZMax >= 0) rayZMax = -uniform_near_far.x;
		if (signdz > 0 && rayZMax >= 0) rayZMax = -uniform_near_far.y;

		prevZMaxEstimate = rayZMax;
		if (rayZMin > rayZMax) swap(rayZMin, rayZMax); 

		pndcZ = texelFetch(sampler_depth, ivec2(hitPixel), 0).r;
		float sceneZ = reconstructCSZ(pndcZ);
		
		if (sceneZ < rayZMax + THICKNESS && sceneZ >= rayZMin) 
			has_hit = true;
#ifdef NO_HIT
		has_hit = false;
#endif // NO_HIT

		vec2 seed = getSamplingSeedIteration(TexCoord, jitter * (stepCount + 1) / float(NUM_SAMPLES));
		rnd = rand1n(seed) - 0.5;
    } 
	
	hitDepth = pndcZ;

	if (pndcZ == 1.0)
		has_hit = true;
	return has_hit;
}

vec3 Fresnel_Schlick(vec3 R0, float HO)
{
	float u = 1.0 - HO;
	float u5 = u * u;
	u5 = u5 * u5 * u;
	return min(vec3(1.0), R0 + (vec3(1.0) - R0) * u5);
}

void main(void)
{
	// discard any diffuse surfaces
	vec4 spec_surface = texture(sampler_specular, TexCoord.xy);
	float gloss = spec_surface.y;
	if (gloss < 0.95) discard;
	float metallic = spec_surface.z;
	vec4 color_surface = texture(sampler_albedo, TexCoord.xy);
	vec3 ks = spec_surface.x*mix(vec3(1),color_surface.rgb,metallic);
	
	float surface_smoothness = spec_surface.g * 127.0 + 1.0;
	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, texture(sampler_depth, TexCoord.xy).r);
	vec3 pwcs = PointECS2WCS(pecs);

	// incoming view direction in ECS and WCS
	vec3 vertex_to_view_direction_ecs = -normalize(pecs);

	vec2 normal_packed = texture(sampler_normal, TexCoord.xy).xy;
	vec3 normal_unclamped_ecs = normal_decode_spheremap1(normal_packed.rg);
	vec4 sample_pos_pndc;

	// get reflection vector between view and normal
	vec3 reflection_dir_ecs = calc_reflection_vector(vertex_to_view_direction_ecs, normal_unclamped_ecs);

	vec3 final_reflection = vec3(0);
	ivec2 image_size = textureSize(sampler_depth, 0);

	float brdf_normalization_factor = (surface_smoothness + 8.0) / (8.0 * 3.1459);
	//float brdf_normalization_factor = (surface_smoothness + 2.0) / (2.0 * 3.1459);
	// blinn phong brdf (based on half vector)
	// the cosine factor of the angle between the incident direction and the normal 
	// in the denominator of the brdf is removed because of the same calculation
	// in the numerator of the integral
	
	vec3 H = normalize(reflection_dir_ecs + vertex_to_view_direction_ecs);
	// GP: the H dot N calculation is redundant for perfect reflections. Always 1.
	// float hdotv = max(dot(H, normal_unclamped_ecs), 0.01);
	float hdotv = 1.0f;//max(dot(H, normal_unclamped_ecs), 0.01);
	// normalized blinn-phong brdf
	float brdf = pow(hdotv, surface_smoothness) * brdf_normalization_factor;
	
	// Fresnel term
	hdotv = max(dot(H, reflection_dir_ecs), 0.01);
	ks = Fresnel_Schlick(ks, hdotv);
		
	// phong brdf (based on reflection vector)
	//float thdotv = max(dot(ray_reflection_dir, reflection_dir), 0.01);
	//float brdf = pow(thdotv, surface_smoothness) * brdf_normalization_factor;
	bool has_hit = false;
	float dimming = 1.0;
#ifdef SCREEN_SPACE_MARCHING
	vec3        csOrigin = pecs;
	vec3        csDirection = reflection_dir_ecs;
	vec2		hitPixel = vec2(-1);

	has_hit = traceScreenSpaceRay(csOrigin, csDirection, sample_pos_pndc.z, hitPixel);
	sample_pos_pndc.xy = hitPixel / vec2(image_size);
#endif // SCREEN_SPACE_MARCHING
    

#ifdef WORLD_SPACE_MARCHING		
	vec3 sample_pos = pecs;
	final_reflection = vec3(0);	
	vec3 prev_sample_pos = sample_pos;		
	float length_step = uniform_scene_length * 0.5 / float(NUM_SAMPLES);
	float sample_depth = 1.0;
	for (int i = 1; i < NUM_SAMPLES && has_hit == false; ++i)
	{
		vec2 seed = getSamplingSeedIteration(TexCoord, i/float(NUM_SAMPLES));
		float rand_iter = rand1n(seed) - 0.5;
		
		// get sample
		prev_sample_pos = sample_pos;
		sample_pos = pecs + (i*length_step + 1*rand_iter*length_step) * reflection_dir_ecs;
		
		// transform sample position to ndc coordinates and scale to [0, 1] range
		sample_pos_pndc = uniform_proj * vec4(sample_pos, 1);
		sample_pos_pndc /= sample_pos_pndc.w;
		sample_pos_pndc.xyz = vec3(0.5) * sample_pos_pndc.xyz + vec3(0.5);

		// check that we are inside clipping frustum
		vec2 dist_to_clip_plane = (clamp(sample_pos_pndc.xy, vec2(0,0), vec2(1,1)) - sample_pos_pndc.xy);
		if (dist_to_clip_plane != vec2(0,0)) // exit
		{
			i = NUM_SAMPLES;
			has_hit = false;
		}
		else
		{
			// project sample to depth buffer
			sample_depth = texture(sampler_depth, sample_pos_pndc.xy).r;
	
			// unproject to ECS
			vec4 sample_pos_proj_ecs = uniform_proj_inverse * vec4(2 * sample_pos_pndc.xy - 1, 2 * sample_depth - 1, 1);
			sample_pos_proj_ecs /= sample_pos_proj_ecs.w;

			// if the projected sample is closer than the sample's z and within a predefined thickness
			has_hit = (sample_pos.z < sample_pos_proj_ecs.z && sample_pos_proj_ecs.z - sample_pos.z < THICKNESS);
		}
	}
#endif // WORLD_SPACE_MARCHING

	if (has_hit)
	{
#ifdef WORLD_SPACE_MARCHING
#ifdef REPROJECTION
		// find distance between previous point and current
		vec3 dir_sample_pos_to_prev_sample_pos = sample_pos - prev_sample_pos;
		vec3 reproj_sample_pos = prev_sample_pos;
		float marching_step = length(dir_sample_pos_to_prev_sample_pos) / (NUM_REPROJECTION_SAMPLES + 1);
		vec3 marching_dir = normalize(dir_sample_pos_to_prev_sample_pos);
		for (int i = 1; i <= NUM_REPROJECTION_SAMPLES; ++i)
		{
			reproj_sample_pos += marching_step * marching_dir;
				
			vec4 reproj_sample_pos_pndc = uniform_proj * vec4(reproj_sample_pos, 1);
			reproj_sample_pos_pndc /= reproj_sample_pos_pndc.w;
			reproj_sample_pos_pndc.xyz = 0.5 * reproj_sample_pos_pndc.xyz + 0.5;

			float reproj_depth = texture(sampler_depth, reproj_sample_pos_pndc.xy).r;

			// if we are behind the depth buffer, keep it and exit
			if (reproj_depth < reproj_sample_pos_pndc.z)
			{
				// change the sample position with our reprojected sample position
				sample_pos_pndc = reproj_sample_pos_pndc;
				sample_pos = reproj_sample_pos;
				sample_depth = reproj_depth;	
				i = NUM_REPROJECTION_SAMPLES;					
			}
		}
#endif // REPROJECTION
#endif // WORLD_SPACE_MARCHING
		
		// get the reflection color
		vec2 sample_normal_packed = texture(sampler_normal, sample_pos_pndc.xy).xy;
		vec3 sample_normal_unclamped_ecs = normal_decode_spheremap1(sample_normal_packed.rg);
		// TODO: this here SHOULD recalculate direct lighting for each sample
		// This now assumes that the received color is between the path (L->sample->eye)
		// while it should be L -> sample -> reflection_point -> eye)
		vec3 sample_reflection_color = texture(sampler_lighting, sample_pos_pndc.xy).xyz;
		sample_reflection_color.xyz *= brdf;
		final_reflection = vec3(sample_reflection_color);
	}
	
	// border dimming, using squared box gradient
	vec2 dimcoord = 2.0*(sample_pos_pndc.xy - vec2(0.5));
	dimming = 1.0-max(dimcoord.x*dimcoord.x,dimcoord.y*dimcoord.y);
	
	// clip incoming radiance from backfacing fragments 
    normal_packed = texture(sampler_normal, sample_pos_pndc.xy).xy;
	normal_unclamped_ecs = normal_decode_spheremap1(normal_packed.rg);
	
	if (sample_pos_pndc.z > 0.0 && sample_pos_pndc.z < 1.0)
		dimming*= dot(-normal_unclamped_ecs,reflection_dir_ecs)>=0.0?1.0:0.0;
	
	//if (!has_hit)
	//final_reflection = texture(sampler_lighting, sample_pos_pndc.xy).xyz;
	
	final_reflection *= ks * dimming  / 3.14;

	out_color = vec4(final_reflection, 1.0);
}
