// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the code for clipping primitives against the pixel frustum boundaries
// This function is used twice during the Build stage:
// First, in the Fill Depth pass to calculate the Z extents for the clipped primitives
// Second, in the Fill Primitives pass to compare a clipped primitive against the stored Z extents and place them in the appropriate depth subintervals (buckets)

#line 9

#define EPSILON 0.0000001
#define LTF 0
#define RTF 1
#define LBF 2
#define RBF 3
#define LTN 4
#define RTN 5
#define LBN 6
#define RBN 7

#define NEAR	0
#define FAR		1
#define RIGHT	2
#define LEFT	3
#define TOP		4
#define BOTTOM	5

#define LINE_FRUSTUM_TEST

// This is an approximate - but faster clipping function
// instead of clipping against six planes, we clip the plane containing the triangle against the four lines connecting the near and far plane vertices, along with the near and far clipping distance
// the downside of this approximation results in overapproximation of the clipping distances, which is more evident in oblique primitives against the view
// Parameters:
// cubeindex  - the current view index
// p1, p2, p3 - the vertex positions
// Returns the clipped Z extents of the primitive for the current pixel
// 
// The uniform variables used are:
// uniform_plane_points_wcs, an array containing the world space position of the frustum corners for all views
// uniform_near_far, an array containing the near far clipping distance for all views
// uniform_view_array, an array containing the world->eye transformation for all views
// uniform_viewports, an array containing the viewport for all views
vec2 clip(vec3 p1, vec3 p2, vec3 p3, int lod)
{
	vec2 res;
#ifndef ACCURATE_BOUNDS // use the non-clipped boundaries (very bad as primitives can extend many pixels)
	float pecsZ1 = (uniform_view_array[uniform_cube_index] * vec4(p1,1)).z;
	float pecsZ2 = (uniform_view_array[uniform_cube_index] * vec4(p2,1)).z;
	float pecsZ3 = (uniform_view_array[uniform_cube_index] * vec4(p3,1)).z;

	pecsZ1 = min(pecsZ1, -uniform_near_far[uniform_cube_index].x);
	pecsZ2 = min(pecsZ2, -uniform_near_far[uniform_cube_index].x);
	pecsZ3 = min(pecsZ3, -uniform_near_far[uniform_cube_index].x);

	float d1 = -pecsZ1, d2 = -pecsZ2, d3 = -pecsZ3;
	float Zmin = min(d1,min(d2,d3));
	float Zmax = max(d1,max(d2,d3));
#else
	// accurate depth bounds			
	// get interpolation parameters for this pixel
	vec2 fragCoord_lb;
	vec2 fragCoord_rt;

	vec4 f_viewport = vec4(0);
	float step_lod = float(pow(2, lod));
	float divstep = 1.0 / step_lod;
	ivec2 lod_coords	  = ivec2(floor(gl_FragCoord.xy * divstep));	
	f_viewport.xy = lod_coords	  << lod;
	f_viewport.zw = f_viewport.xy  + step_lod;
	f_viewport = vec4(f_viewport.x, f_viewport.y, f_viewport.z, f_viewport.w);
	fragCoord_lb = vec2(f_viewport.x, f_viewport.y) / uniform_viewports[uniform_cube_index].zw;
	fragCoord_rt = vec2(f_viewport.z, f_viewport.w) / uniform_viewports[uniform_cube_index].zw;
	
	/*
	float top_a		= fragCoord_rt.y;
	float right_a	= fragCoord_rt.x;
	float bottom_a	= fragCoord_lb.y;
	float left_a	= fragCoord_lb.x;
	*/
	vec3 external_points_wcs[8];
	int points_index = uniform_cube_index * 8;
	for (int i = 0; i < 8; ++i)
		external_points_wcs[i] = vec3(uniform_plane_points_wcs[points_index + i]);

	// calculate pixel frustum points by interpolating using the external frustum positions
	vec3 pixel_pos_wcs[8];
	vec3 vertical1;
	vec3 vertical2;
	vertical1 = mix(external_points_wcs[LBF], external_points_wcs[LTF], fragCoord_rt.y);
	vertical2 = mix(external_points_wcs[RBF], external_points_wcs[RTF], fragCoord_rt.y);
	pixel_pos_wcs[LTF] = mix(vertical1, vertical2, fragCoord_lb.x);
	pixel_pos_wcs[RTF] = mix(vertical1, vertical2, fragCoord_rt.x);
	vertical1 = mix(external_points_wcs[LBF], external_points_wcs[LTF], fragCoord_lb.y);
	vertical2 = mix(external_points_wcs[RBF], external_points_wcs[RTF], fragCoord_lb.y);
	pixel_pos_wcs[LBF] = mix(vertical1, vertical2, fragCoord_lb.x);
	pixel_pos_wcs[RBF] = mix(vertical1, vertical2, fragCoord_rt.x);
	vertical1 = mix(external_points_wcs[LBN], external_points_wcs[LTN], fragCoord_rt.y);
	vertical2 = mix(external_points_wcs[RBN], external_points_wcs[RTN], fragCoord_rt.y);
	pixel_pos_wcs[LTN] = mix(vertical1, vertical2, fragCoord_lb.x);
	pixel_pos_wcs[RTN] = mix(vertical1, vertical2, fragCoord_rt.x);
	vertical1 = mix(external_points_wcs[LBN], external_points_wcs[LTN], fragCoord_lb.y);
	vertical2 = mix(external_points_wcs[RBN], external_points_wcs[RTN], fragCoord_lb.y);
	pixel_pos_wcs[LBN] = mix(vertical1, vertical2, fragCoord_lb.x);
	pixel_pos_wcs[RBN] = mix(vertical1, vertical2, fragCoord_rt.x);	

#ifdef LINE_FRUSTUM_TEST
	vec3 triangle_normal = cross(p2.xyz - p1.xyz, p3.xyz - p1.xyz);
	triangle_normal = normalize(triangle_normal);
	float triangle_d = 0;
	for (int i = 0; i < 3; ++i)
		triangle_d -= triangle_normal[i] * p1[i];

	vec3 ray_origin[4] = {
    pixel_pos_wcs[LTN],
    pixel_pos_wcs[RTN],
    pixel_pos_wcs[LBN],
    pixel_pos_wcs[RBN]
    };

	vec3 ray_line[4] = {
	 pixel_pos_wcs[LTF] - pixel_pos_wcs[LTN],
	 pixel_pos_wcs[RTF] - pixel_pos_wcs[RTN],
	 pixel_pos_wcs[LBF] - pixel_pos_wcs[LBN],
	 pixel_pos_wcs[RBF] - pixel_pos_wcs[RBN]
	};

	float ray_line_length[4] = {
		length(ray_line[0]),
		length(ray_line[1]),
		length(ray_line[2]),
		length(ray_line[3])
	};

	float pecsZ1 = -(uniform_view_array[uniform_cube_index] * vec4(p1,1)).z;
	float pecsZ2 = -(uniform_view_array[uniform_cube_index] * vec4(p2,1)).z;
	float pecsZ3 = -(uniform_view_array[uniform_cube_index] * vec4(p3,1)).z;
	float primZmin = min(pecsZ1,min(pecsZ2,pecsZ3));
	float primZMax = max(pecsZ1,max(pecsZ2,pecsZ3));

	float near = uniform_near_far[uniform_cube_index].x;
	float far = uniform_near_far[uniform_cube_index].y;
	// initialize min to far and max to near
	float Zmin = far;
	float Zmax = near;	
	// perform ray-plane intersections for each ray
	// and store the min and max extents in eye space
	for (int i = 0; i < 4; ++i)
	{
		vec3 raystart = ray_origin[i];
		vec3 ray_dir = ray_line[i]/ray_line_length[i];
		float td = -((dot(raystart, triangle_normal)) + triangle_d);
		float d = dot(ray_dir, triangle_normal);
		td = td / d;
		if (abs(d) > 0.001 && td > 0 && td < ray_line_length[i])
		{
			vec3 intersectpoint_wcs = raystart + td * ray_dir;
			float intersectpoint = -(uniform_view_array[uniform_cube_index] * vec4(intersectpoint_wcs, 1)).z;
			Zmin = max(near, min(Zmin, intersectpoint));
			Zmax = min(far,  max(Zmax, intersectpoint));
		}
	}
	Zmin = max(Zmin, primZmin);
	Zmax = min(Zmax, primZMax);
	
	res = vec2(Zmin, Zmax);
#endif// LINE_FRUSTUM_TEST

return res;
#endif // ACCURATE_BOUNDS
}