using System;
using System.Collections.Generic;
using System.Text;

namespace CapFinLoan.Application.Domain.Enums
{
	public enum ApplicationStatus
	{
		Draft = 0,
        Submitted = 1,
        DocsPending = 2,
        DocsVerified = 3,
        UnderReview = 4,
        Approved = 5,
        Rejected = 6,
        Closed = 7
	}
}
