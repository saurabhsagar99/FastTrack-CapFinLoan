using System;
using System.Collections.Generic;
using System.Text;

namespace CapFinLoan.Document.Domain.Enums
{
	/// <summary>
	/// Enum for required document types in loan application.
	/// These four documents are mandatory for loan application submission.
	/// </summary>
	public enum DocumentType
	{
		/// <summary>
		/// Know Your Customer document (Aadhar Card or PAN Card)
		/// </summary>
		KYC = 1,

		/// <summary>
		/// Address proof document (utility bill, rent agreement, etc.)
		/// </summary>
		AddressProof = 2,

		/// <summary>
		/// Income proof document (salary slip, tax return, etc.)
		/// </summary>
		IncomeProof = 3,

		/// <summary>
		/// Bank statement document
		/// </summary>
		BankStatement = 4
	}
}
