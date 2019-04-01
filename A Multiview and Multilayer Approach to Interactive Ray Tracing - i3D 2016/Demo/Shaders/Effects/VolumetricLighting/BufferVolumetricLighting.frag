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
#version 420 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;

layout(binding = 1, std140) uniform frustum_buffer
{
	vec4 frustum_triangles_far[4];
};

uniform sampler2D sampler_depth;
uniform sampler2D sampler_shadow_map;

uniform vec3 uniform_camera_pos_wcs;
uniform mat4 uniform_view;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_proj_inv;

uniform mat4 uniform_light_view;
uniform mat4 uniform_light_projection;
uniform vec3 uniform_light_color;
uniform vec3 uniform_light_direction;
uniform vec3 uniform_light_position;
uniform int uniform_light_is_conical;
uniform float uniform_light_cosine_umbra;
uniform float uniform_light_cosine_penumbra;
uniform float uniform_spotlight_exponent;

uniform float uniform_time_sec;

uniform uint uniform_samples;

uniform int uniform_phase_function_type;
uniform float uniform_g;
uniform float uniform_k;
uniform float uniform_d;
uniform float uniform_l;
uniform float uniform_n;
uniform int uniform_has_particle_animation;
uniform int uniform_particle_animation_type;

uniform float uniform_constant_bias;

#ifndef PI
#define PI 3.1415936
#endif // PI

#define HG 0
#define SCHLICK 1
#define RAYLEIGH 2
#define LORENZ_MIE_HAZY 3
#define LORENZ_MIE_MURKY 4

#define DUSTY 0

#include "random_number.h"

vec3 reconstruct_wcs_position()
{
	vec4 clipPos; // clip space reconstruction
	clipPos.x = 2.0 * TexCoord.x - 1.0;
	clipPos.y = 2.0 * TexCoord.y - 1.0;
	clipPos.z = 2.0 * texture(sampler_depth, TexCoord.xy).r -1.0;
	clipPos.w = 1.0;
	
	vec4 pwcs = uniform_view_proj_inv * clipPos; // clip space -> world space

	return pwcs.xyz / pwcs.w; // return world space pos xyz
}

bool shadow_nearest(vec3 light_space_xyz)
{
	// sample shadow map
	float shadow_map_z = texture(sampler_shadow_map, light_space_xyz.xy).r;

	// + shaded -> 0.0 
	// - lit -> 1.0
	return (light_space_xyz.z - uniform_constant_bias < shadow_map_z) ? true : false;
}

float shadow_pcf_3x3(vec3 plcs)
{
	float res = textureSize(sampler_shadow_map,0).x;
	// + shaded -> 0.0 
	// - lit -> 1.0
	float shadow_map_step = 1.5 / res;
	float sum = 0.0;
	// the center
	float shadow_map_z = texture(sampler_shadow_map, plcs.xy).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, +1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, +1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(0.0, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, -1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(+shadow_map_step, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, 0]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, 0.0)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, 0]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(+shadow_map_step, 0.0)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, -1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(-shadow_map_step, -shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, -1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(0.0, -shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, +1]
	shadow_map_z = texture(sampler_shadow_map, plcs.xy + vec2(+shadow_map_step, +shadow_map_step)).r;
	sum += clamp(-sign(plcs.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);

	sum = sum / 9.0;
	return sum;
}

// 1 sample per pixel
float shadow(vec3 pwcs)
{
	// project the pwcs to the light source point of view
	vec4 plcs = uniform_light_projection * uniform_light_view * vec4(pwcs, 1.0);
	
	// perspective division
	plcs /= plcs.w;
	
	// convert from [-1 1] to [0 1]
	plcs.xy = (plcs.xy + 1) * 0.5;
	
	// check that we are inside light clipping frustum !!!!!
	if (plcs.x < 0.0) return 0.0;
	if (plcs.y < 0.0) return 0.0;
	if (plcs.x > 1.0) return 0.0;
	if (plcs.y > 1.0) return 0.0;

	// set scale of light space z vaule to [0, 1]
	plcs.z = 0.5 * plcs.z + 0.5;

	// sample shadow map
	//return shadow_nearest(plcs.xyz)?1.0:0.0;
	return shadow_pcf_3x3(plcs.xyz);
	
}

float check_spotlight(vec3 vertex_to_light_direction_wcs) // for now, works in world space
{
	float spoteffect = 1;
	if (uniform_light_is_conical == 1)
	{
		float angle_vertex_spot_dir = dot(normalize(-vertex_to_light_direction_wcs), uniform_light_direction);

		// if angle is less than the penumbra (cosine is reverse)
		// if angle is between the penumbra region
		// if angle is outside the umbra region
		if (angle_vertex_spot_dir >= uniform_light_cosine_penumbra) 
			spoteffect = 1;
		else if (uniform_light_cosine_penumbra > angle_vertex_spot_dir && uniform_light_cosine_umbra < angle_vertex_spot_dir)
		{
			float attenuate = (angle_vertex_spot_dir - uniform_light_cosine_umbra) / (uniform_light_cosine_penumbra - uniform_light_cosine_umbra);
			spoteffect = pow(attenuate, uniform_spotlight_exponent);
		}
		else spoteffect = 0;
	}
	return spoteffect;
}

bool rayTriangleIntersect(vec3 p1, vec3 p2, vec3 p3, vec3 origin, vec3 direction, out float intersection_distance)
{	
	float ray_length = length(direction);
	direction = normalize(direction);
	vec3 e_1 = p2 - p1;
	vec3 e_2 = p3 - p1;

	vec3 q = cross(direction, e_2);
	float a = dot(e_1, q);

	if (abs(a) <= 0.00001)
	{	
		return false;
	}

	vec3 s = (origin - p1) / a;
	vec3 r = cross(s, e_1);

	vec2 b = vec2 (dot(s, q), dot(r, direction));

	// this gives you the intersection point
	// pass this out and read it in case of a valid intersection 
	intersection_distance = dot(e_2, r);

	return all(bvec4(b.x >= 0.0, b.y >= 0.0, b.x + b.y <= 1.0, intersection_distance > 0)) ? true: false;
}

bool findIntersectionDistances(inout vec3 trace_start, inout vec3 trace_end, vec3 ray_dir)
{
	float intersection_distance = -1.0;
	vec2 intersection_distances = vec2(-10.0,-10.0);
	
	// pyramid, we need only far points and the light's position
	
	// left
	if(rayTriangleIntersect(frustum_triangles_far[0].xyz, frustum_triangles_far[2].xyz, uniform_light_position, trace_start, ray_dir, intersection_distance))
	{
		if(intersection_distances.x < 0.0)
			intersection_distances.x = intersection_distance;
		else if(intersection_distances.y < 0.0)
			intersection_distances.y = intersection_distance;
	}
	
	// right
	if(rayTriangleIntersect(frustum_triangles_far[1].xyz, frustum_triangles_far[3].xyz, uniform_light_position, trace_start, ray_dir, intersection_distance))
	{
		if(intersection_distances.x < 0.0)
			intersection_distances.x = intersection_distance;
		else if(intersection_distances.y < 0.0)
			intersection_distances.y = intersection_distance;
	}
	
	// top
	if(rayTriangleIntersect(frustum_triangles_far[0].xyz, frustum_triangles_far[1].xyz, uniform_light_position, trace_start, ray_dir, intersection_distance))
	{
		if(intersection_distances.x < 0.0)
			intersection_distances.x = intersection_distance;
		else if(intersection_distances.y < 0.0)
			intersection_distances.y = intersection_distance;
	}
	
	// bottom
	if(rayTriangleIntersect(frustum_triangles_far[2].xyz, frustum_triangles_far[3].xyz, uniform_light_position, trace_start, ray_dir, intersection_distance))
	{
		if(intersection_distances.x < 0.0)
			intersection_distances.x = intersection_distance;
		else if(intersection_distances.y < 0.0)
			intersection_distances.y = intersection_distance;
	}
	
	// far1
	if(rayTriangleIntersect(frustum_triangles_far[0].xyz, frustum_triangles_far[1].xyz, frustum_triangles_far[2].xyz, trace_start, ray_dir, intersection_distance))
	{
		if(intersection_distances.x < 0.0)
			intersection_distances.x = intersection_distance;
		else if(intersection_distances.y < 0.0)
			intersection_distances.y = intersection_distance;
	}
	
	// far2
	if(rayTriangleIntersect(frustum_triangles_far[1].xyz, frustum_triangles_far[2].xyz, frustum_triangles_far[3].xyz, trace_start, ray_dir, intersection_distance))
	{
		if(intersection_distances.x < 0.0)
			intersection_distances.x = intersection_distance;
		else if(intersection_distances.y < 0.0)
			intersection_distances.y = intersection_distance;
	}

	bool res = false;
	float original_ray_length = length(trace_end - trace_start);
	vec3 ray_dir_normalized = normalize(ray_dir);
	vec3 temp_end = trace_start +  ray_dir_normalized * max(intersection_distances.x,intersection_distances.y);
	float start_to_temp_ray_length = length(temp_end - trace_start);
	if(intersection_distances.x > 0.0 && intersection_distances.y > 0.0) // check first if there are 2 collisions (we are outside the frustum)
	{
		vec3 temp_start = trace_start + ray_dir_normalized * min(intersection_distances.x,intersection_distances.y);
		float temp_start_to_ray_length = length(temp_start - trace_start);
		
		if(start_to_temp_ray_length <= original_ray_length) // if max intersection point is closer than the trace_end then
		{
			trace_end = temp_end; // the ray's end is now the max distance intersection point with the frustum
			trace_start = temp_start; // and the ray's start is now the min distance intersection with the frustum 
		
			res = true; // ray is clipped inside frustum - we need sampling
		}
		else if(start_to_temp_ray_length > original_ray_length && start_to_temp_ray_length >= original_ray_length) 
		{	// if max intersection point is further than the trace_end AND min intersection point is also further than the trace_end
			res = false; // ray is obstructed from the frustum, we don't need sampling
		}
		else if(start_to_temp_ray_length > original_ray_length && start_to_temp_ray_length < original_ray_length) 
		{	// if max intersection point is further than the trace_end AND min intersection point is closer than the trace_end
			trace_start = temp_start; // ray starts outside frustum and ends up inside 
			
			res = true; // we need sampling
		}
	}
	else if(intersection_distances.x > 0.0) // then check if there is 1 collision (we are inside the frustum)
	{		
		if(start_to_temp_ray_length <= original_ray_length) // if intersection point is closer than the trace_end then
			trace_end = temp_end; // then the new trace end is the intersection point
		// else the trace_end stays the same(because we look at something inside the frustum)
		
		res = true; // we are inside frustum so we need always need sampling (mandatory)
	}
	
	return res; // no intersection, no sampling 
}

float Henyey_Greenstein(float angle_cosine, float g)
{
	return (1 - pow(g,2.0))/(4 * PI * pow((1 + pow(g,2.0) - 2 * g * angle_cosine),3.0/2.0));
}

float Schlick(float angle_cosine, float k)
{
	return (1 - pow(k,2.0))/(4 * PI * pow((1 + k * angle_cosine),2.0)); 
}

float Rayleigh(float angle_cosine, float d, float l, float n)
{
	float scattering_coefficient = (2*pow(pi,5.0)/3) * (pow(d,6.0)/pow(l,4.0)) * pow((pow(n,2.0) - 1)/(pow(n,2.0) + 2) , 2.0);	
	return (1/(16.0 * pi)) * (1 + pow(angle_cosine,2.0)) * scattering_coefficient;
}

float Lorenz_Mie_Hazy(float angle_cosine)
{
	return 1/(4 * pi) * (0.5 + 4.5 * pow((1 + angle_cosine)/2 , 8.f));
}

float Lorenz_Mie_Murky(float angle_cosine)
{
	return 1/(4 * pi) * (0.5 + 16.5 * pow((1 + angle_cosine)/2 , 32.f));
}

float hash (float n)
{
	return fract(sin(n)*43758.5453);
}

void Dusty_Animation(vec3 ray_jittered_pos_wcs, inout float g, inout float k, inout float d, inout float l, inout float n)
{
	vec3 temp = ray_jittered_pos_wcs + uniform_time_sec*0.4;

	vec3 p = floor(temp);
	vec3 f = fract(temp);

	f = f*f*(3.0-2.0*f);

	float i = p.x + p.y*57.0 + 113.0*p.z;


	g = 2* mix(mix(mix( hash(i+  0.0), hash(i+  1.0),f.x),
	mix( hash(i+ 57.0), hash(i+ 58.0),f.x),f.y),
	mix(mix( hash(i+113.0), hash(i+114.0),f.x),
	mix( hash(i+170.0), hash(i+171.0),f.x),f.y),f.z)-1;

	k = g;

	d = 0.2 * (1  + g) * 2;
	l = 0.2 * (1  + g) * 2;
	n = 0.2 * (1  + g) * 2;
}

void main(void)
{
	vec3 trace_start = uniform_camera_pos_wcs; // tracing starting pos
	vec3 trace_end = reconstruct_wcs_position(); // tracing ending pos
	
	vec3 ray_dir = trace_end - trace_start; // ray step direction

	float light_factor = 0.0;
	// checks ray from trace_start to inf(far in direction ray_dir) and updates trace_start and trace_end accordingly
	bool res = findIntersectionDistances(trace_start, trace_end, ray_dir);
	if(res) // if there is need for sampling
	{
		float step_distance = length(trace_start - trace_end) / uniform_samples; // length of each each ray unit

		ray_dir = normalize(ray_dir);

		vec3 jittered_step_dir = ray_dir; // keep the vector clean
		
		vec3 ray_step_dist = ray_dir * step_distance; // move by step = step_distance
		
		vec3 ray_pos_wcs = trace_start; // starting wcs pos of ray
		
		for(int i = 0 ; i < uniform_samples; ++i) // fix sampling issues
		{
			// if sample is unlit 
			float shadow_factor = shadow(ray_pos_wcs);
			if(shadow_factor<=0.0)
			{
				ray_pos_wcs += ray_step_dist; // move a step
				continue; // next sample
			}
			
			vec3 ray_jittered_pos_wcs = ray_pos_wcs; // jittered location
			
			float jittering = 0.5 * rand1n(TexCoord.xy * 17 + uniform_time_sec + (i+1)/float(uniform_samples)); 
			
			ray_jittered_pos_wcs += jittered_step_dir * (jittering * step_distance);//jittering (small step)
			
			// calculate spot effect
			vec3 vertex_to_light_direction_wcs = uniform_light_position - ray_jittered_pos_wcs;
			vertex_to_light_direction_wcs = normalize(vertex_to_light_direction_wcs);
			float spot_effect = check_spotlight(vertex_to_light_direction_wcs);
		
			float g = uniform_g;
			float k = uniform_k;
			float d = uniform_d;
			float l = uniform_l;
			float n = uniform_n;

			// select animation type
			if(uniform_has_particle_animation == 1)
			{
				if(uniform_particle_animation_type == DUSTY)
				{
					Dusty_Animation(ray_jittered_pos_wcs, g, k, d, l, n);
				}
			}
			
			vec3 sample_light_dir = normalize(uniform_light_position - ray_jittered_pos_wcs); 
			float angle_cosine = dot(ray_dir,sample_light_dir); 
			
			float phase;

			// select phase function
			if(uniform_phase_function_type == HG)
			{
				phase = Henyey_Greenstein(angle_cosine, g);
			}
			else if(uniform_phase_function_type == SCHLICK)
			{
				phase = Schlick(angle_cosine, k);
			}
			else if(uniform_phase_function_type == RAYLEIGH)
			{
				phase = Rayleigh(angle_cosine, d, l, n);
			}
			else if(uniform_phase_function_type == LORENZ_MIE_HAZY)
			{
				phase = Lorenz_Mie_Hazy(angle_cosine);
			}
			else if(uniform_phase_function_type == LORENZ_MIE_MURKY)
			{
				phase = Lorenz_Mie_Murky(angle_cosine);
			}
		
			float dis = distance(trace_start, ray_jittered_pos_wcs);
			float s = 0.8;
			light_factor += step_distance * spot_effect * shadow_factor * phase * exp(-dis*s);
			
			ray_pos_wcs += ray_step_dist; // move a step
		}
	}
	out_color = light_factor * vec4(uniform_light_color,1); 
}










 