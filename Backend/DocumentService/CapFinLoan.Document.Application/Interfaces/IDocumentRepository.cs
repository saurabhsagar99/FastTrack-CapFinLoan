using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Document.Domain.Models;

namespace CapFinLoan.Document.Application.Interfaces
{
	public interface IDocumentRepository
	{
		Task<DocumentEntity> AddAsync(DocumentEntity document);
		Task<IEnumerable<DocumentEntity>> GetByApplicationIdAsync(int applicationId);
		Task<DocumentEntity?> GetByIdAsync(int id);
		Task<DocumentEntity?> GetByIdAndUserAsync(int id, string userId);
		Task UpdateAsync(DocumentEntity document);
		Task DeleteAsync(DocumentEntity document);
	}
}
