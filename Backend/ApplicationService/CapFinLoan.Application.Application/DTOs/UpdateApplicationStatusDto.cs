using System.ComponentModel.DataAnnotations;

namespace CapFinLoan.Application.Application.DTOs
{
	public class UpdateApplicationStatusDto
	{
		[Required]
		public string Status { get; set; } = string.Empty;

		[MaxLength(500)]
		public string? StatusNote { get; set; }
	}
}
