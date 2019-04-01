// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains basic conversion, random generation and helper function routines.

#line 6

// Reconstructs a position in ECS based on its coordinates in post-projective space
// Parameters:
// - texcoord, the XY screen-space coordinates [0,1]
// - depth, the depth value [0,1]
// - index, the view index
// returns the reconstructed ECS position
vec3 reconstruct_position_from_depth(vec2 texcoord, float depth, int index)
{
	vec4 pndc = vec4(2 * vec3(texcoord.xy, depth) - 1, 1);
	vec4 pecs = uniform_proj_inverse[index] * pndc;
	pecs.xyz = pecs.xyz/pecs.w;
	return pecs.xyz;
}

// Projects an eye space Z value to
// Parameters:
// - pecsZ, the eye space Z value
// - index, the view index
// returns the Z value in post-projective space [0, 1]
float projectZ(float pecsZ, int index)
{
	float tmpZ = -pecsZ * (uniform_near_far[index].x + uniform_near_far[index].y) - (2 * uniform_clip_info[index].x);
	tmpZ /= -pecsZ * uniform_clip_info[index].y;
	return tmpZ * 0.5 + 0.5;
}

// Spheremap Decoding based on Lambert Azimuthal Equal - Area projection
// Parameters:
// - normal, the compressed normal
// returns the uncompressed normal
// Source: http://aras-p.info/texts/CompactNormalStorage.html
vec3 normal_decode_spheremap1(vec2 normal)
{
	vec2 fenc = normal * 4 - 2;
	float f = dot(fenc, fenc);
	float g = sqrt(1 - f / 4);
	vec3 n;
	n.xy = fenc*g;
	n.z = 1 - f / 2;
	return n;
}

// convert a vector from WCS to ECS
// Parameters:
// - v_wcs, the input vector in WCS
// - index, the view index
// returns a vec3 in ECS
vec3 VectorWCS2ECS(in vec3 v_wcs, int index)
{
	vec4 v_ecs = uniform_view[index] * vec4(v_wcs,0);
	return v_ecs.xyz;
}

// convert a vector from ECS to WCS
// Parameters:
// - v_ecs, the input vector in ECS
// - index, the view index
// returns a vec3 in WCS
vec3 VectorECS2WCS(in vec3 v_ecs, int index)
{
	vec4 v_wcs = uniform_view_inverse[index] * vec4(v_ecs,0);
	return v_wcs.xyz;
}

// convert a point from WCS to ECS
// Parameters:
// - p_wcs, the input point in WCS
// - index, the view index
// returns a vec3 in ECS
vec3 PointWCS2ECS(in vec3 v_wcs, int index)
{
	vec4 v_ecs = uniform_view[index] * vec4(v_wcs,1);
	return v_ecs.xyz;
}

// convert a point from ECS to WCS
// Parameters:
// - p_ecs, the input point in ECS
// - index, the view index
// returns a vec3 in WCS
vec3 PointECS2WCS(in vec3 p_ecs, int index)
{
	vec4 p_wcs = uniform_view_inverse[index] * vec4(p_ecs,1);
	return p_wcs.xyz;
}

const float pi = 3.1415936;

// implementation based on: lumina.sourceforge.net/Tutorials/Noise.html
// Fast random number generator
// Parameters:
// - seed, the generator's seed
// Returns a number in the range [0-1)
float rand1n(vec2 seed)
{
    highp vec3 abc = vec3(12.9898, 78.233, 43758.5453);
    highp float dt= dot(seed.xy, vec2(abc.x,abc.y));
    highp float sn= mod(dt, 2*pi);
    return max(0.01, fract(sin(sn) * abc.z));
}

// Fast random number generator
// Parameters:
// - seed, the generator's seed
// Returns two numbers in the range [0-1)
vec2 rand2n(vec2 seed) {
	return vec2(rand1n(seed), rand1n(seed * vec2(11, 13))); 
};

// Fast random number generator
// Parameters:
// - seed, the generator's seed
// Returns three numbers in the range [0-1)
vec3 rand3n(vec2 seed) {
	return vec3(rand1n(seed), rand1n(seed * vec2(11, 13)), rand1n(seed * vec2(19, 23)));
}

// Retrieves a random seed for screen-space passes based on UV coordinates
// Parameters:
// - iteration, an iteration number
// Returns a vec2 seed number
vec2 getSamplingSeed(float iteration)
{
	return TexCoord.xy * 17 * (uniform_progressive_sample + fract(uniform_time)) * (iteration + fract(uniform_time));
}

// Retrieves a random seed based on the eye space position
// Parameters:
// - position_ecs, the eye space position
// - iteration, an iteration number
// Returns a vec2 seed number
vec2 getPositionSamplingSeed(vec3 position_ecs, float iteration)
{
	return position_ecs.xy * 29 + position_ecs.zx * 43 + TexCoord.xy * 17 * (uniform_progressive_sample + fract(uniform_time)) * (iteration + fract(uniform_time));
}

#ifdef RAY_PREVIEW_ENABLED
#ifdef TRACE_HIZ_DEBUG
// drawViewport - helper function to draw a tile
// Parameters
// - P0, a point inside the viewport (if P0 is outside then this function returns un)
// - P1, a point potentially outside the viewport
// - lod, check to draw only tiles smaller than the screen
// - cubeindex, the view index
// Returns the intersection value between the two points
// Note: point P0 needs to be inside the viewport
void drawViewport(vec2 P0, vec2 P1, int lod, int cubeindex)
{
	if (isDebugFragment() && lod > 1)
	{
		vec2 start = P0;
		vec2 end = P1;
		vec4 c = vec4(0.05, 0.5, 0, -1.0);
		for (float i = start.x-1; i <= end.x; ++i)
		{
			storeRay(ivec3(i, start.y, cubeindex), c);
			storeRay(ivec3(i, end.y, cubeindex), c);
			storeRay(ivec3(i, start.y-1, cubeindex), c);
			storeRay(ivec3(i, end.y+1, cubeindex), c);
		}
	
		for (float i = start.y-1; i <= end.y; ++i)
		{
			storeRay(ivec3(start.x, i, cubeindex), c);
			storeRay(ivec3(end.x, i, cubeindex), c);
			storeRay(ivec3(start.x-1, i, cubeindex), c);
			storeRay(ivec3(end.x+1, i, cubeindex), c);
		}
	}
}
#endif // TRACE_HIZ_DEBUG

// storeRayPoint - helper function to draw a ray point
// Parameters
// - hitPixel, the ray point
// - cubeindex, the view index
void storeRayPoint(vec2 hitPixel, int cubeindex)
{
	// just write the ray points to the ray texture
	if (isDebugFragment())
	{
		vec4 color_ray = vec4(1, 0.25, 0, -1.0);
		for (int rx = -2; rx <= 2; rx++)
		{	
			for (int ry = -2; ry <= 2; ry++)
			{	
				storeRay(ivec3(hitPixel.xy + vec2(rx,ry), cubeindex),  color_ray);
			}
		}
	}
}

// storeRayStartEndHit - helper function to draw the ray's start, end and hit points
// Parameters
// - tP0, the ray origin
// - tP1, the clipped ray end for the current view
// - hitPixel, the ray hit point
// - cubeindex, the view index
void storeRayStartEndHit(vec2 tP0, vec2 tP1, vec2 hitPixel, int cubeindex, bool has_hit)
{
	// just write the start, end and hit ray points to the ray texture
	if (isDebugFragment())
	{
		vec4 color_start = vec4(0.05, 1.0, 0, -1.0);
		vec4 color_end = vec4(1, 0.75, 0, -1.0);
		vec4 color_hit = vec4(1, 0.05, 0, -1.0);
		for (int rx = -2; rx <= 2; rx++)
		{
			for (int ry = -2; ry <= 2; ry++)
			{
				storeRay(ivec3(tP0.xy + vec2(rx,ry), cubeindex),  color_start);
				storeRay(ivec3(tP1.xy + vec2(rx,ry), cubeindex),  color_end);
				if (has_hit)
					storeRay(ivec3(hitPixel.xy + vec2(rx,ry), cubeindex),  color_hit);
			}
		}
	}
}
#endif // RAY_PREVIEW_ENABLED

// Color Utilities

// HSV to RGB conversion
// Parameters:
// - c, the HSV value, where values are in the range [0,1]
// Returns the RGB value
// Source: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 hsv2rgb_normalized(vec3 c)
{
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// HSV to RGB conversion
// Parameters:
// - c, the HSV value, where H is in the range [0, 360] and SV values are in the range [0,1]
// Returns the RGB value
vec3 hsv2rgb(vec3 c)
{
	c.x /= 360.0;
	return hsv2rgb_normalized(c);
}