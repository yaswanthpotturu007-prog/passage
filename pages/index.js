{result.unlockedBy ? (
                <p style={{ color: '#3C5A44' }}>✓ Based on your {result.unlockedBy}</p>
              ) : result.baselineExhaustive ? (
                <p style={{ color: '#3C5A44' }}>✓ Confirmed: no document changes this — passport nationality decides here</p>
              ) : (
                <p style={{ color: '#B23A2F', fontWeight: 500 }}>
                  ⚠ Not yet verified for the document(s) you listed. Documents CAN change the answer for this destination,
                  but we haven't checked your specific combination yet. Confirm with an official source before booking.
                </p>
              )}
