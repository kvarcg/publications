// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the blending stage

#version 330 core

#define __COMPRESSION_METHOD__

layout(location = 0) out vec4 out_data0;
layout(location = 1) out vec4 out_data1;
layout(location = 2) out vec4 out_data2;
layout(location = 3) out vec4 out_data3;
layout(location = 4) out vec4 out_data4;
layout(location = 5) out vec4 out_data5;
layout(location = 6) out vec4 out_data6;

in vec2 TexCoord;

uniform sampler3D sampler_current_points[7];
uniform sampler3D sampler_prev_points[7];
uniform vec3 uniform_bbox_max;
uniform vec3 uniform_bbox_min;
uniform vec3 uniform_stratum;
uniform float uniform_blend_factor;

flat in int vCurrentLayer;

void main(void)
{
	vec3 voxel_coord = vec3(gl_FragCoord.xy, vCurrentLayer + 0.5);
	
	vec3 extents = uniform_bbox_max - uniform_bbox_min;
	// position is initialized at the center of the current voxel
	vec3 pos_wcs = uniform_bbox_min + vec3(voxel_coord) * uniform_stratum;

	vec3 uvw = (pos_wcs - uniform_bbox_min) / extents;

	// check for unoccupied CRC voxel and skip (occupied voxels have 1.0 alpha)	
	float occupancy_flag = 0.0;
#if defined (NOCOMPRESSION) || defined(CONVERSION)
		occupancy_flag = texelFetch(sampler_current_points[6], ivec3(voxel_coord), 0).a;
#elif defined(LOW_COMPRESSION)
		occupancy_flag = texelFetch(sampler_current_points[4], ivec3(voxel_coord), 0).b;
#elif defined(HIGH_COMPRESSION)
		occupancy_flag = texelFetch(sampler_current_points[2], ivec3(voxel_coord), 0).a;
#endif // COMPRESSION
	if (occupancy_flag < 1.0) discard;

#if defined (NOCOMPRESSION) || defined(CONVERSION)
		vec4 prev_data0		= texture(sampler_prev_points[0], uvw);
		vec4 prev_data1		= texture(sampler_prev_points[1], uvw);
		vec4 prev_data2		= texture(sampler_prev_points[2], uvw);
		vec4 prev_data3		= texture(sampler_prev_points[3], uvw);
		vec4 prev_data4		= texture(sampler_prev_points[4], uvw);
		vec4 prev_data5		= texture(sampler_prev_points[5], uvw);
		vec4 prev_data6		= texture(sampler_prev_points[6], uvw);
		vec4 cur_data0		= texture(sampler_current_points[0], uvw);
		vec4 cur_data1		= texture(sampler_current_points[1], uvw);
		vec4 cur_data2		= texture(sampler_current_points[2], uvw);
		vec4 cur_data3		= texture(sampler_current_points[3], uvw);
		vec4 cur_data4		= texture(sampler_current_points[4], uvw);
		vec4 cur_data5		= texture(sampler_current_points[5], uvw);
		vec4 cur_data6		= texture(sampler_current_points[6], uvw);
		// 0 deactivated
		// 1 only prev frame
		out_data0			= mix(cur_data0, prev_data0, uniform_blend_factor);
		out_data1			= mix(cur_data1, prev_data1, uniform_blend_factor);
		out_data2			= mix(cur_data2, prev_data2, uniform_blend_factor);
		out_data3			= mix(cur_data3, prev_data3, uniform_blend_factor);
		out_data4			= mix(cur_data4, prev_data4, uniform_blend_factor);
		out_data5			= mix(cur_data5, prev_data5, uniform_blend_factor);
		out_data6			= mix(cur_data6, prev_data6, uniform_blend_factor);
		out_data6.a			= 1.0;
#elif defined(LOW_COMPRESSION)
		vec4 prev_data0		= texture(sampler_prev_points[0], uvw);
		vec4 prev_data1		= texture(sampler_prev_points[1], uvw);
		vec4 prev_data2		= texture(sampler_prev_points[2], uvw);
		vec4 prev_data3		= texture(sampler_prev_points[3], uvw);
		vec4 prev_data4		= texture(sampler_prev_points[4], uvw);
		vec4 cur_data0		= texture(sampler_current_points[0], uvw);
		vec4 cur_data1		= texture(sampler_current_points[1], uvw);
		vec4 cur_data2		= texture(sampler_current_points[2], uvw);
		vec4 cur_data3		= texture(sampler_current_points[3], uvw);
		vec4 cur_data4		= texture(sampler_current_points[4], uvw);
		// 0 deactivated
		// 1 only prev frame
		out_data0			= mix(cur_data0, prev_data0, uniform_blend_factor);
		out_data1			= mix(cur_data1, prev_data1, uniform_blend_factor);
		out_data2			= mix(cur_data2, prev_data2, uniform_blend_factor);
		out_data3			= mix(cur_data3, prev_data3, uniform_blend_factor);
		out_data4			= mix(cur_data4, prev_data4, uniform_blend_factor);
		out_data4.b			= 1.0;
#elif defined(HIGH_COMPRESSION)
		vec4 prev_data0		= texture(sampler_prev_points[0], uvw);
		vec4 prev_data1		= texture(sampler_prev_points[1], uvw);
		vec4 prev_data2		= texture(sampler_prev_points[2], uvw);
		vec4 cur_data0		= texture(sampler_current_points[0], uvw);
		vec4 cur_data1		= texture(sampler_current_points[1], uvw);
		vec4 cur_data2		= texture(sampler_current_points[2], uvw);
		// 0 deactivated
		// 1 only prev frame
		out_data0			= mix(cur_data0, prev_data0, uniform_blend_factor);
		out_data1			= mix(cur_data1, prev_data1, uniform_blend_factor);
		out_data2			= mix(cur_data2, prev_data2, uniform_blend_factor);
		out_data2.a			= 1.0;
#endif // COMPRESSION
}
