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
in vec2 TexCoord;
uniform sampler2D sampler_input;
uniform sampler2D sampler_color;

uniform ivec2 uniform_dimensions;
uniform int uniform_has_blur;	


float weight[25] = float[](0.003765,	0.015019,	0.023792,	0.015019,	0.003765,
						   0.015019,	0.059912,	0.094907,	0.059912,	0.015019,
						   0.023792,	0.094907,	0.150342,	0.094907,	0.023792,
						   0.015019,	0.059912,	0.094907,	0.059912,	0.015019,
						   0.003765,	0.015019,	0.023792,	0.015019,	0.003765);


#define SCALE  1 

void main(void)
{
	vec4 color = texture(sampler_color, TexCoord.xy);
	
	vec4 light_volume_color = texture(sampler_input, TexCoord.xy);
	
	if(uniform_has_blur == 1)
	{
		vec2 dimensions_scaled = uniform_dimensions / SCALE;
		
		light_volume_color = vec4(0,0,0,0);
		
		int weight_counter = 0;
	
		//single pass 5x5 sigma = 1 Gaussian blur
		for(int i = -2; i < 2; i++)
		{
			for(int j = -2; j < 2; j++)
			{
				light_volume_color += texture(sampler_input, TexCoord.xy + vec2(j,i) / dimensions_scaled) * weight[weight_counter];
				weight_counter++;
			}
		}	
	}
	
	out_color = color + light_volume_color;
}