// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the vertex implementation for previewing GI data

#version 330 core
layout(location = 0) in vec3 position;

uniform mat4 uniform_view_proj;
uniform mat4 uniform_scale;

uniform ivec3 uniform_resolution;
uniform vec3 uniform_bbox_min;
uniform vec3 uniform_bbox_max;
uniform vec3 uniform_radius;

flat out vec3 crc_position;
flat out ivec3 crc_voxel_position;
out vec3 in_normal_wcs;
out vec3 in_pos_wcs;

void main(void)
{
	// instanceID 0 - voxels

	// sample from the grid
	ivec3 grid_position;
	grid_position.z = gl_InstanceID / (uniform_resolution.x * uniform_resolution.y);
	grid_position.y = (gl_InstanceID / uniform_resolution.x) % uniform_resolution.y;
	grid_position.x = gl_InstanceID % uniform_resolution.x;

	vec3 uvw_pos = vec3(grid_position) / uniform_resolution;

	in_normal_wcs = -position;

	vec3 stratum = (uniform_bbox_max - uniform_bbox_min) / vec3(uniform_resolution);
	
	vec3 pos_wcs = vec3(uniform_scale * vec4(position, 1.0)).xyz;
	
	pos_wcs += uniform_bbox_min + (grid_position + 0.5) * stratum;
		
	in_pos_wcs =  pos_wcs;

	crc_voxel_position = grid_position;

	// add an offset to get it to the center of the voxel
	uvw_pos += vec3(0.5) / (vec3(uniform_resolution));
	crc_position = uvw_pos;
	
    gl_Position = uniform_view_proj * vec4(pos_wcs, 1);
}
