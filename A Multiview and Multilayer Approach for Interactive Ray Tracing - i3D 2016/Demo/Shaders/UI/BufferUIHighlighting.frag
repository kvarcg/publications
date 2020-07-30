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
#version 330 core

layout(location = 0) out vec4 out_color;

uniform usampler2D sampler_item;
uniform sampler2D sampler_depth;

uniform vec4 uniform_color;
uniform uint uniform_itemID;
uniform vec4 uniform_outside_color;
uniform int uniform_geometry_type;
uniform vec4 uniform_material_color;
uniform mat4 uniform_mvp;
uniform mat4 uniform_pixel_step;

//#define USE_OUTLINE_COLOR
void main(void)
{

#ifndef USE_OUTLINE_COLOR
	out_color = uniform_material_color;
	return;
#endif

	vec2 texcoord = vec2(gl_FragCoord.xy / textureSize(sampler_item, 0));
	uint itemID = uint(texture(sampler_item, texcoord).r);
	// get stored depth at fragment
	float depth = texture(sampler_depth, texcoord).r;

	float alpha = 1;
	
	// ghost mode for hidden parts of the object
	// enters here if the ids are different at the same fragment
	// and the other id is in front of the current one
	//if (itemID != uniform_itemID)
	//{
	//	if (gl_FragCoord.z > depth)
	//	{
	//		out_color.rgb = uniform_material_color.rgb;
	//		out_color.a = alpha;
	//	}
	//	return;
	//}
	
	float pixelStep = 1.0;

	vec2 textureStep = pixelStep / vec2(textureSize(sampler_item, 0));

	vec2 indices[8];
	indices[0] = vec2(-1, -1);
	indices[1] = vec2(-1, 0);
	indices[2] = vec2(-1, 1);
	indices[3] = vec2(0, -1);
	indices[4] = vec2(0, 1);
	indices[5] = vec2(1, -1);
	indices[6] = vec2(1, 0);
	indices[7] = vec2(1, 1);

	uint curItemID = 0u;
	float curDepth = 0;
	bool objBehind = false;
	bool objInFront = false;
	
	int num_in_front = 0;
	int num_behind = 0;

	// enter here if the id's are the same
	// draw an outline where the id's are different
	// objects in front should not be affected
	for (int i = 0; i < 8; ++i)
	{
		curItemID = texture(sampler_item, texcoord + textureStep * indices[i]).r;
		curDepth = texture(sampler_depth, texcoord + textureStep * indices[i]).r;
		if (curItemID == uniform_itemID)
			continue;
		
		if (curDepth <= gl_FragCoord.z)
		{
			objInFront = true;
			num_in_front = num_in_front + 1;
		}
		else
		{
			objBehind = true;
			num_behind = num_behind + 1;
		}
	}
	
	if (num_in_front == 0 && num_behind == 0)
	{
		// all samples fell on the same object
		// ghost mode again
		out_color.rgb = uniform_material_color.rgb;
		out_color.a = 1;
		return;
	}	

	if (num_in_front == 0)
	{
		out_color.rgb = uniform_material_color.rgb;
		out_color.a = 1;
	}
	else 
	{
		// in front of the object
		out_color.rgb = uniform_material_color.rgb;
		out_color.a = 1;
	}

}
