using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Document.Application.DTOs;

namespace CapFinLoan.Document.Application.Interfaces
{
	public interface IDocumentService
	{
		Task<DocumentResponseDto> UploadDocumentAsync(UploadDocumentDto dto, string userId);
		Task<IEnumerable<DocumentResponseDto>> GetDocumentsByApplicationAsync(int applicationId);
		Task<DocumentResponseDto> VerifyDocumentAsync(int docId, VerifyDocumentDto dto);
		Task<DocumentFileDto> GetDocumentFileAsync(int docId, string userId, bool isAdmin);
		Task<bool> DeleteDocumentAsync(int docId, string userId);
	}
}
